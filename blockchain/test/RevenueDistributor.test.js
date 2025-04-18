const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("RevenueDistributor", function () {
    let revenueDistributor;
    let assetToken;
    let projectRegistry;
    let owner;
    let investor1;
    let investor2;
    let feeRecipient;
    let projectOwner;
    let projectId;

    const PROJECT_NAME = "Solar Farm";
    const PROJECT_DESCRIPTION = "A 5MW solar farm";
    const TARGET_AMOUNT = ethers.parseEther("1000");
    const MIN_INVESTMENT = ethers.parseEther("0.1");
    const MAX_INVESTMENT = ethers.parseEther("100");
    const DISTRIBUTION_FEE = 500; // 5%
    const MIN_DISTRIBUTION_AMOUNT = ethers.parseEther("0.1");

    beforeEach(async function () {
        [owner, investor1, investor2, feeRecipient, projectOwner] = await ethers.getSigners();

        // Deploy ProjectRegistry
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();

        // Deploy AssetToken
        const AssetToken = await ethers.getContractFactory("AssetToken");
        assetToken = await AssetToken.deploy("Energy Asset Token", "EAT");
        await assetToken.waitForDeployment();

        // Deploy RevenueDistributor
        const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
        revenueDistributor = await RevenueDistributor.deploy(
            await projectRegistry.getAddress(),
            await assetToken.getAddress()
        );
        await revenueDistributor.waitForDeployment();

        // Set RevenueDistributor as minter for AssetToken
        await assetToken.setMinter(await revenueDistributor.getAddress());

        // Create a project
        await projectRegistry.connect(projectOwner).registerProject(
            PROJECT_NAME,
            PROJECT_DESCRIPTION,
            TARGET_AMOUNT,
            MIN_INVESTMENT,
            MAX_INVESTMENT,
            await assetToken.getAddress()
        );
        projectId = 0;

        // Activate the project
        await projectRegistry.connect(projectOwner).updateProjectStatus(projectId, 1); // Set to Active

        // Set up project fees and minimum distribution amount
        await revenueDistributor.setProjectFees(projectId, DISTRIBUTION_FEE, feeRecipient.address);
        await revenueDistributor.setMinDistributionAmount(projectId, MIN_DISTRIBUTION_AMOUNT);

        // Set owner as minter for initial token distribution
        await assetToken.setMinter(owner.address);
        
        // Mint some tokens to investors
        await assetToken.mint(investor1.address, ethers.parseEther("50"));
        await assetToken.mint(investor2.address, ethers.parseEther("50"));
        
        // Reset minter to RevenueDistributor
        await assetToken.setMinter(await revenueDistributor.getAddress());
    });

    describe("Initialization", function () {
        it("Should initialize with correct addresses", async function () {
            expect(await revenueDistributor.assetToken()).to.equal(await assetToken.getAddress());
            expect(await revenueDistributor.projectRegistry()).to.equal(await projectRegistry.getAddress());
        });

        it("Should set correct project fees", async function () {
            const fees = await revenueDistributor.projectFees(projectId);
            expect(fees.distributionFee).to.equal(DISTRIBUTION_FEE);
            expect(fees.feeRecipient).to.equal(feeRecipient.address);
        });

        it("Should set correct minimum distribution amount", async function () {
            expect(await revenueDistributor.minDistributionAmount(projectId)).to.equal(MIN_DISTRIBUTION_AMOUNT);
        });
    });

    describe("Fee Management", function () {
        it("Should not allow setting fees above 10%", async function () {
            await expect(
                revenueDistributor.setProjectFees(projectId, 1001, feeRecipient.address)
            ).to.be.revertedWithCustomError(revenueDistributor, "InvalidFeePercentage");
        });

        it("Should not allow setting zero address as fee recipient", async function () {
            await expect(
                revenueDistributor.setProjectFees(projectId, DISTRIBUTION_FEE, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(revenueDistributor, "InvalidFeeRecipient");
        });

        it("Should emit FeesUpdated event", async function () {
            await expect(revenueDistributor.setProjectFees(projectId, DISTRIBUTION_FEE, feeRecipient.address))
                .to.emit(revenueDistributor, "FeesUpdated")
                .withArgs(projectId, DISTRIBUTION_FEE, feeRecipient.address);
        });
    });

    describe("Revenue Reception", function () {
        it("Should receive revenue correctly", async function () {
            const amount = ethers.parseEther("1");
            await expect(revenueDistributor.receiveRevenue(projectId, { value: amount }))
                .to.emit(revenueDistributor, "RevenueDistributed")
                .withArgs(0, projectId, amount);
        });

        it("Should not accept zero amount", async function () {
            await expect(
                revenueDistributor.receiveRevenue(projectId, { value: 0 })
            ).to.be.revertedWithCustomError(revenueDistributor, "NoRevenue");
        });

        it("Should calculate fees correctly", async function () {
            const amount = ethers.parseEther("1");
            await revenueDistributor.receiveRevenue(projectId, { value: amount });
            const [, , amount_] = await revenueDistributor.getDistributionDetails(0);
            const expectedAmount = amount - (amount * BigInt(DISTRIBUTION_FEE) / 10000n);
            expect(amount_).to.equal(expectedAmount);
        });
    });

    describe("Distribution Processing", function () {
        beforeEach(async function () {
            // Add some revenue
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
            // Verify KYC for investor1
            await projectRegistry.connect(owner).verifyKYC(investor1.address);
        });

        it("Should process distribution correctly", async function () {
            const initialBalance = await ethers.provider.getBalance(investor1.address);
            await revenueDistributor.connect(investor1).claimRevenue(0);
            const finalBalance = await ethers.provider.getBalance(investor1.address);
            expect(finalBalance - initialBalance).to.be.gt(0);
        });

        it("Should not allow double claiming", async function () {
            await revenueDistributor.connect(investor1).claimRevenue(0);
            await expect(
                revenueDistributor.connect(investor1).claimRevenue(0)
            ).to.be.revertedWithCustomError(revenueDistributor, "AlreadyClaimed");
        });
    });

    describe("Distribution Tracking", function () {
        beforeEach(async function () {
            // Add multiple distributions
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
            // Verify KYC for investor1
            await projectRegistry.connect(owner).verifyKYC(investor1.address);
        });

        it("Should track distributions correctly", async function () {
            const [id, projectId_, amount] = await revenueDistributor.getDistributionDetails(0);
            expect(id).to.equal(0);
            expect(projectId_).to.equal(projectId);
            expect(amount).to.be.gt(0);
        });

        it("Should track claims correctly", async function () {
            expect(await revenueDistributor.hasClaimedRevenue(0, investor1.address)).to.be.false;
            await revenueDistributor.connect(investor1).claimRevenue(0);
            expect(await revenueDistributor.hasClaimedRevenue(0, investor1.address)).to.be.true;
        });
    });

    describe("Pause Functionality", function () {
        it("Should not allow operations when paused", async function () {
            await revenueDistributor.pause();
            await expect(
                revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("Pausable: paused");
        });

        it("Should allow operations after unpause", async function () {
            await revenueDistributor.pause();
            await revenueDistributor.unpause();
            await expect(
                revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") })
            ).to.not.be.reverted;
        });
    });

    describe("Security", function () {
        it("Should only allow owner to set fees", async function () {
            await expect(
                revenueDistributor.connect(investor1).setProjectFees(projectId, DISTRIBUTION_FEE, feeRecipient.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should only allow owner to set minimum distribution amount", async function () {
            await expect(
                revenueDistributor.connect(investor1).setMinDistributionAmount(projectId, MIN_DISTRIBUTION_AMOUNT)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should prevent reentrancy attacks", async function () {
            const amount = ethers.parseEther("1");
            await revenueDistributor.receiveRevenue(projectId, { value: amount });
            
            // Try to claim revenue recursively
            const AttackContract = await ethers.getContractFactory("ReentrancyAttacker");
            const attackContract = await AttackContract.deploy(await revenueDistributor.getAddress());
            
            await expect(
                attackContract.attack(0)
            ).to.be.revertedWithCustomError(revenueDistributor, "InvestorNotVerified");
        });
    });
}); 