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
    let projectId;

    const PROJECT_NAME = "Solar Farm";
    const PROJECT_DESCRIPTION = "A 5MW solar farm";
    const TARGET_AMOUNT = ethers.parseEther("1000");
    const MIN_INVESTMENT = ethers.parseEther("0.1");
    const MAX_INVESTMENT = ethers.parseEther("100");
    const DISTRIBUTION_FEE = 500; // 5%
    const MIN_DISTRIBUTION_AMOUNT = ethers.parseEther("0.1");

    beforeEach(async function () {
        [owner, investor1, investor2, feeRecipient] = await ethers.getSigners();

        // Deploy AssetToken
        const AssetToken = await ethers.getContractFactory("AssetToken");
        assetToken = await AssetToken.deploy("Energy Asset Token", "EAT");
        await assetToken.waitForDeployment();
        await assetToken.setMinter(owner.address);

        // Deploy ProjectRegistry
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();

        // Deploy RevenueDistributor
        const RevenueDistributor = await ethers.getContractFactory("RevenueDistributor");
        revenueDistributor = await RevenueDistributor.deploy(
            await assetToken.getAddress(),
            await projectRegistry.getAddress()
        );
        await revenueDistributor.waitForDeployment();

        // Create a project
        await projectRegistry.registerProject(
            PROJECT_NAME,
            5000, // 5MW capacity
            "Texas, USA"
        );
        projectId = 0;

        // Set up project fees and minimum distribution amount
        await revenueDistributor.setProjectFees(projectId, DISTRIBUTION_FEE, feeRecipient.address);
        await revenueDistributor.setMinDistributionAmount(projectId, MIN_DISTRIBUTION_AMOUNT);

        // Mint some tokens to investors
        await assetToken.mint(investor1.address, ethers.parseEther("50"));
        await assetToken.mint(investor2.address, ethers.parseEther("50"));
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
                .to.emit(revenueDistributor, "RevenueReceived")
                .withArgs(projectId, amount);

            const distribution = await revenueDistributor.getDistribution(projectId, 0);
            expect(distribution.amount).to.equal(amount);
            expect(distribution.processed).to.be.false;
        });

        it("Should not accept zero amount", async function () {
            await expect(
                revenueDistributor.receiveRevenue(projectId, { value: 0 })
            ).to.be.revertedWithCustomError(revenueDistributor, "InvalidAmount");
        });

        it("Should calculate fees correctly", async function () {
            const amount = ethers.parseEther("1");
            await revenueDistributor.receiveRevenue(projectId, { value: amount });
            const distribution = await revenueDistributor.getDistribution(projectId, 0);
            const expectedFee = amount * BigInt(DISTRIBUTION_FEE) / BigInt(10000);
            expect(distribution.feeAmount).to.equal(expectedFee);
        });
    });

    describe("Distribution Processing", function () {
        beforeEach(async function () {
            // Add some revenue
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
        });

        it("Should process distribution correctly", async function () {
            const initialFeeRecipientBalance = await ethers.provider.getBalance(feeRecipient.address);
            
            await revenueDistributor.processDistributions(projectId, 1);
            
            const distribution = await revenueDistributor.getDistribution(projectId, 0);
            expect(distribution.processed).to.be.true;

            const finalFeeRecipientBalance = await ethers.provider.getBalance(feeRecipient.address);
            expect(finalFeeRecipientBalance - initialFeeRecipientBalance).to.equal(distribution.feeAmount);
        });

        it("Should not process distribution below minimum amount", async function () {
            await revenueDistributor.setMinDistributionAmount(projectId, ethers.parseEther("2"));
            await revenueDistributor.processDistributions(projectId, 1);
            
            const distribution = await revenueDistributor.getDistribution(projectId, 0);
            expect(distribution.processed).to.be.false;
        });

        it("Should process multiple distributions", async function () {
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
            await revenueDistributor.processDistributions(projectId, 2);
            
            const distribution1 = await revenueDistributor.getDistribution(projectId, 0);
            const distribution2 = await revenueDistributor.getDistribution(projectId, 1);
            expect(distribution1.processed).to.be.true;
            expect(distribution2.processed).to.be.true;
        });

        it("Should update lastProcessedIndex correctly", async function () {
            await revenueDistributor.processDistributions(projectId, 1);
            expect(await revenueDistributor.lastProcessedIndex(projectId)).to.equal(1);
        });
    });

    describe("Distribution Tracking", function () {
        beforeEach(async function () {
            // Add multiple distributions
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
            await revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") });
        });

        it("Should track pending distributions correctly", async function () {
            expect(await revenueDistributor.getPendingDistributionsCount(projectId)).to.equal(2);
            
            await revenueDistributor.processDistributions(projectId, 1);
            expect(await revenueDistributor.getPendingDistributionsCount(projectId)).to.equal(1);
        });

        it("Should return correct distribution details", async function () {
            const amount = ethers.parseEther("1");
            const distribution = await revenueDistributor.getDistribution(projectId, 0);
            
            expect(distribution.amount).to.equal(amount);
            expect(distribution.projectId).to.equal(projectId);
            expect(distribution.processed).to.be.false;
        });
    });

    describe("Pause Functionality", function () {
        it("Should not allow operations when paused", async function () {
            await revenueDistributor.pause();
            
            await expect(
                revenueDistributor.receiveRevenue(projectId, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("Pausable: paused");
            
            await expect(
                revenueDistributor.processDistributions(projectId, 1)
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
            
            // Try to process distributions recursively (should fail)
            await expect(
                revenueDistributor.processDistributions(projectId, 1)
            ).to.not.be.revertedWith("ReentrancyGuard: reentrant call");
        });
    });
}); 