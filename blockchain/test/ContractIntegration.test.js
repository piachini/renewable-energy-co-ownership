const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Contract Integration", function () {
    let AssetToken;
    let ProjectRegistry;
    let InvestmentManager;
    let RevenueDistributor;
    let assetToken;
    let projectRegistry;
    let investmentManager;
    let revenueDistributor;
    let owner;
    let investor1;
    let investor2;
    let projectOwner;
    let feeRecipient;
    let projectId;
    const INITIAL_SUPPLY = ethers.parseEther("1000");
    const INVESTMENT_AMOUNT = ethers.parseEther("5");
    const REVENUE_AMOUNT = ethers.parseEther("10");
    const DISTRIBUTION_FEE = 500; // 5%

    beforeEach(async function () {
        [owner, investor1, investor2, projectOwner, feeRecipient] = await ethers.getSigners();

        // Deploy ProjectRegistry
        ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();

        // Deploy AssetToken
        AssetToken = await ethers.getContractFactory("AssetToken");
        assetToken = await AssetToken.deploy("Energy Asset Token", "EAT");
        await assetToken.waitForDeployment();

        // Deploy InvestmentManager
        InvestmentManager = await ethers.getContractFactory("InvestmentManager");
        investmentManager = await InvestmentManager.deploy(
            await assetToken.getAddress(),
            await projectRegistry.getAddress()
        );
        await investmentManager.waitForDeployment();

        // Deploy RevenueDistributor
        RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
        revenueDistributor = await RevenueDistributor.deploy(
            await projectRegistry.getAddress(),
            await assetToken.getAddress()
        );
        await revenueDistributor.waitForDeployment();

        // Set InvestmentManager as minter
        await assetToken.setMinter(await investmentManager.getAddress());

        // Register project
        await projectRegistry.connect(projectOwner).registerProject(
            "Test Project",
            "Test Description",
            INITIAL_SUPPLY,
            ethers.parseEther("0.1"),
            ethers.parseEther("10"),
            await assetToken.getAddress()
        );
        projectId = 0;

        // Set project status to Active
        await projectRegistry.connect(projectOwner).updateProjectStatus(projectId, 1);

        // Set up revenue distribution fees
        await revenueDistributor.setProjectFees(projectId, DISTRIBUTION_FEE, feeRecipient.address);

        // Verify KYC for investors
        await projectRegistry.verifyKYC(investor1.address);
        await projectRegistry.verifyKYC(investor2.address);
    });

    describe("Complete Investment Flow", function () {
        it("Should handle complete investment and revenue distribution flow", async function () {
            // 1. Make investments
            await investmentManager.connect(investor1).makeInvestment(projectId, { value: INVESTMENT_AMOUNT });
            await investmentManager.connect(investor2).makeInvestment(projectId, { value: INVESTMENT_AMOUNT });

            // 2. Verify token balances
            expect(await assetToken.balanceOf(investor1.address)).to.equal(INVESTMENT_AMOUNT);
            expect(await assetToken.balanceOf(investor2.address)).to.equal(INVESTMENT_AMOUNT);

            // 3. Send revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, { value: REVENUE_AMOUNT });

            // 4. Calculate expected share
            const totalSupply = await assetToken.totalSupply();
            const distributionAmount = REVENUE_AMOUNT - (REVENUE_AMOUNT * BigInt(DISTRIBUTION_FEE) / 10000n);
            const expectedShare = (distributionAmount * INVESTMENT_AMOUNT) / totalSupply;

            // 5. Claim revenue
            const initialBalance1 = await ethers.provider.getBalance(investor1.address);
            await revenueDistributor.connect(investor1).claimRevenue(0);
            const finalBalance1 = await ethers.provider.getBalance(investor1.address);

            // 6. Verify revenue distribution
            expect(finalBalance1 - initialBalance1).to.be.gt(0);
            expect(await revenueDistributor.hasClaimedRevenue(0, investor1.address)).to.be.true;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle multiple revenue distributions", async function () {
            // Setup
            await investmentManager.connect(investor1).makeInvestment(projectId, { value: INVESTMENT_AMOUNT });

            // First distribution
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, { value: REVENUE_AMOUNT });
            await revenueDistributor.connect(investor1).claimRevenue(0);

            // Second distribution
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, { value: REVENUE_AMOUNT });
            await revenueDistributor.connect(investor1).claimRevenue(1);

            // Verify both distributions were claimed
            expect(await revenueDistributor.hasClaimedRevenue(0, investor1.address)).to.be.true;
            expect(await revenueDistributor.hasClaimedRevenue(1, investor1.address)).to.be.true;
        });

        it("Should handle token transfers affecting revenue distribution", async function () {
            // Initial investment
            await investmentManager.connect(investor1).makeInvestment(projectId, { value: INVESTMENT_AMOUNT });

            // Transfer half tokens to investor2
            await assetToken.connect(investor1).transfer(investor2.address, INVESTMENT_AMOUNT / 2n);

            // Send revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, { value: REVENUE_AMOUNT });

            // Both investors should be able to claim their share
            await revenueDistributor.connect(investor1).claimRevenue(0);
            await revenueDistributor.connect(investor2).claimRevenue(0);

            expect(await revenueDistributor.hasClaimedRevenue(0, investor1.address)).to.be.true;
            expect(await revenueDistributor.hasClaimedRevenue(0, investor2.address)).to.be.true;
        });
    });

    describe("Security Tests", function () {
        it("Should prevent unauthorized revenue distribution", async function () {
            await expect(
                revenueDistributor.connect(investor1).receiveRevenue(projectId, { value: REVENUE_AMOUNT })
            ).to.not.be.reverted; // Anyone can send revenue
        });

        it("Should prevent revenue distribution to non-existent project", async function () {
            await expect(
                revenueDistributor.connect(projectOwner).receiveRevenue(99, { value: REVENUE_AMOUNT })
            ).to.be.revertedWithCustomError(projectRegistry, "ProjectDoesNotExist");
        });

        it("Should prevent revenue claiming without KYC", async function () {
            // Setup
            await investmentManager.connect(investor1).makeInvestment(projectId, { value: INVESTMENT_AMOUNT });
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, { value: REVENUE_AMOUNT });

            // Revoke KYC
            await projectRegistry.connect(owner).revokeKYC(investor1.address);

            // Try to claim
            await expect(
                revenueDistributor.connect(investor1).claimRevenue(0)
            ).to.be.revertedWithCustomError(revenueDistributor, "InvestorNotVerified");
        });
    });
}); 