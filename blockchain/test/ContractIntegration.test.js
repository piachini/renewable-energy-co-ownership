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
    let projectId;
    const INITIAL_SUPPLY = ethers.parseEther("1000");
    const INVESTMENT_AMOUNT = ethers.parseEther("100");
    const REVENUE_AMOUNT = ethers.parseEther("10");

    beforeEach(async function () {
        [owner, investor1, investor2, projectOwner] = await ethers.getSigners();

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

        // Set InvestmentManager as minter
        await assetToken.setMinter(await investmentManager.getAddress());

        // Deploy RevenueDistributor
        RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
        revenueDistributor = await RevenueDistributor.deploy(
            await assetToken.getAddress(),
            await projectRegistry.getAddress()
        );
        await revenueDistributor.waitForDeployment();

        // Register a project
        await projectRegistry.connect(projectOwner).registerProject(
            "Solar Farm Alpha",
            1000,
            "Texas, USA"
        );
        projectId = 0;

        // Set project as active
        await projectRegistry.connect(projectOwner).updateProjectStatus(projectId, 1); // 1 = Active

        // Configure RevenueDistributor
        await revenueDistributor.setProjectFees(projectId, 100, owner.address); // 1% fee
        await revenueDistributor.setMinDistributionAmount(projectId, ethers.parseEther("0.1"));
    });

    describe("Complete Investment Flow", function () {
        it("Should handle complete investment and revenue distribution flow", async function () {
            // 1. Verify KYC for investors
            await projectRegistry.verifyKYC(investor1.address);
            await projectRegistry.verifyKYC(investor2.address);

            // 2. Make investments
            await investmentManager.connect(investor1).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });
            await investmentManager.connect(investor2).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });

            // 3. Check token balances
            const investor1Balance = await assetToken.balanceOf(investor1.address);
            const investor2Balance = await assetToken.balanceOf(investor2.address);
            expect(investor1Balance).to.equal(INVESTMENT_AMOUNT);
            expect(investor2Balance).to.equal(INVESTMENT_AMOUNT);

            // 4. Distribute revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: REVENUE_AMOUNT
            });

            // 5. Process distributions
            await revenueDistributor.processDistributions(projectId, 1);

            // 6. Check revenue distribution
            const investor1Dividends = await assetToken.getClaimableDividends(investor1.address);
            const investor2Dividends = await assetToken.getClaimableDividends(investor2.address);
            const feeAmount = REVENUE_AMOUNT * 100n / 10000n; // 1% fee
            const distributedAmount = REVENUE_AMOUNT - feeAmount;
            expect(investor1Dividends).to.equal(distributedAmount / 2n);
            expect(investor2Dividends).to.equal(distributedAmount / 2n);

            // 7. Claim revenue
            const investor1BalanceBefore = await ethers.provider.getBalance(investor1.address);
            await assetToken.connect(investor1).claimDividends();
            const investor1BalanceAfter = await ethers.provider.getBalance(investor1.address);
            expect(investor1BalanceAfter - investor1BalanceBefore).to.be.closeTo(
                distributedAmount / 2n,
                ethers.parseEther("0.1")
            );
        });
    });

    describe("Edge Cases", function () {
        it("Should handle multiple revenue distributions", async function () {
            // Setup
            await projectRegistry.verifyKYC(investor1.address);
            await investmentManager.connect(investor1).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });

            // First distribution
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: REVENUE_AMOUNT
            });
            await revenueDistributor.processDistributions(projectId, 1);

            // Second distribution
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: REVENUE_AMOUNT
            });
            await revenueDistributor.processDistributions(projectId, 1);

            const totalDividends = await assetToken.getClaimableDividends(investor1.address);
            const feeAmount = REVENUE_AMOUNT * 100n / 10000n; // 1% fee
            const distributedAmount = (REVENUE_AMOUNT - feeAmount) * 2n;
            expect(totalDividends).to.equal(distributedAmount);
        });

        it("Should handle token transfers affecting revenue distribution", async function () {
            // Setup
            await projectRegistry.verifyKYC(investor1.address);
            await projectRegistry.verifyKYC(investor2.address);
            await investmentManager.connect(investor1).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });

            // Transfer half tokens
            await assetToken.connect(investor1).transfer(
                investor2.address,
                INVESTMENT_AMOUNT / 2n
            );

            // Distribute revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: REVENUE_AMOUNT
            });
            await revenueDistributor.processDistributions(projectId, 1);

            const investor1Dividends = await assetToken.getClaimableDividends(investor1.address);
            const investor2Dividends = await assetToken.getClaimableDividends(investor2.address);
            const feeAmount = REVENUE_AMOUNT * 100n / 10000n; // 1% fee
            const distributedAmount = REVENUE_AMOUNT - feeAmount;
            expect(investor1Dividends).to.equal(distributedAmount / 2n);
            expect(investor2Dividends).to.equal(distributedAmount / 2n);
        });
    });

    describe("Security Tests", function () {
        it("Should prevent unauthorized revenue distribution", async function () {
            // Setup: Create tokens first
            await projectRegistry.verifyKYC(investor1.address);
            await investmentManager.connect(investor1).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });

            await expect(
                revenueDistributor.connect(investor1).receiveRevenue(projectId, {
                    value: REVENUE_AMOUNT
                })
            ).to.be.revertedWithCustomError(revenueDistributor, "NotProjectOwner");
        });

        it("Should prevent revenue distribution to non-existent project", async function () {
            await expect(
                revenueDistributor.connect(projectOwner).receiveRevenue(999, {
                    value: REVENUE_AMOUNT
                })
            ).to.be.revertedWithCustomError(revenueDistributor, "InvalidProject");
        });

        it("Should prevent revenue claiming without KYC", async function () {
            // Setup: Create tokens first
            await projectRegistry.verifyKYC(investor1.address);
            await investmentManager.connect(investor1).makeInvestment(projectId, {
                value: INVESTMENT_AMOUNT
            });

            // Distribute revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: REVENUE_AMOUNT
            });
            await revenueDistributor.processDistributions(projectId, 1);

            // Try to claim without KYC
            await expect(
                assetToken.connect(investor2).claimDividends()
            ).to.be.revertedWithCustomError(assetToken, "NoDividendsToClaim");
        });
    });
}); 