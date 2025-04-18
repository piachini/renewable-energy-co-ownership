const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RevenueAutomation", function () {
    let revenueAutomation;
    let revenueDistributor;
    let assetToken;
    let projectRegistry;
    let owner;
    let investor1;
    let investor2;
    let taxRecipient;
    let projectOwner;
    let projectId;
    let distributionCount;

    const PROJECT_NAME = "Solar Farm";
    const PROJECT_DESCRIPTION = "A 5MW solar farm";
    const TARGET_AMOUNT = ethers.parseEther("1000");
    const MIN_INVESTMENT = ethers.parseEther("0.1");
    const MAX_INVESTMENT = ethers.parseEther("100");
    const REINVEST_PERCENTAGE = 5000; // 50%
    const TAX_WITHHOLDING = 2000; // 20%
    const DISTRIBUTION_INTERVAL = 30 * 24 * 60 * 60; // 30 days

    beforeEach(async function () {
        [owner, investor1, investor2, taxRecipient, projectOwner] = await ethers.getSigners();

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

        // Deploy RevenueAutomation
        const RevenueAutomation = await ethers.getContractFactory("RevenueAutomation");
        revenueAutomation = await RevenueAutomation.deploy(
            await revenueDistributor.getAddress(),
            await assetToken.getAddress()
        );
        await revenueAutomation.waitForDeployment();

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

        // Transfer project ownership to RevenueAutomation
        await projectRegistry.connect(projectOwner).transferProjectOwnership(projectId, await revenueAutomation.getAddress());

        // Set up automation configuration
        await revenueAutomation.configureAutomation(
            projectId,
            true, // autoDistribute
            true, // autoReinvest
            REINVEST_PERCENTAGE,
            TAX_WITHHOLDING,
            taxRecipient.address,
            DISTRIBUTION_INTERVAL
        );

        // Advance time to allow first distribution
        await time.increase(DISTRIBUTION_INTERVAL + 1);

        // Set up investor auto-reinvestment
        await revenueAutomation.connect(investor1).setInvestorAutoReinvest(projectId, true);
        await revenueAutomation.connect(investor2).setInvestorAutoReinvest(projectId, true);

        // Set owner as minter for testing
        await assetToken.setMinter(owner.address);

        // Mint some tokens to investors
        await assetToken.mint(investor1.address, ethers.parseEther("50"));
        await assetToken.mint(investor2.address, ethers.parseEther("50"));

        // Verify KYC for investors
        await projectRegistry.verifyKYC(investor1.address);
        await projectRegistry.verifyKYC(investor2.address);
    });

    describe("Initialization", function () {
        it("Should initialize with correct addresses", async function () {
            expect(await revenueAutomation.revenueDistributor()).to.equal(await revenueDistributor.getAddress());
            expect(await revenueAutomation.assetToken()).to.equal(await assetToken.getAddress());
        });

        it("Should set correct automation configuration", async function () {
            const config = await revenueAutomation.getAutomationConfig(projectId);
            expect(config.autoDistribute).to.be.true;
            expect(config.autoReinvest).to.be.true;
            expect(config.reinvestPercentage).to.equal(REINVEST_PERCENTAGE);
            expect(config.taxWithholding).to.equal(TAX_WITHHOLDING);
            expect(config.taxRecipient).to.equal(taxRecipient.address);
            expect(config.distributionInterval).to.equal(DISTRIBUTION_INTERVAL);
        });
    });

    describe("Automation Configuration", function () {
        it("Should not allow invalid reinvestment percentage", async function () {
            await expect(
                revenueAutomation.configureAutomation(
                    projectId,
                    true,
                    true,
                    10001, // > 100%
                    TAX_WITHHOLDING,
                    taxRecipient.address,
                    DISTRIBUTION_INTERVAL
                )
            ).to.be.revertedWithCustomError(revenueAutomation, "InvalidPercentage");
        });

        it("Should not allow invalid tax withholding", async function () {
            await expect(
                revenueAutomation.configureAutomation(
                    projectId,
                    true,
                    true,
                    REINVEST_PERCENTAGE,
                    10001, // > 100%
                    taxRecipient.address,
                    DISTRIBUTION_INTERVAL
                )
            ).to.be.revertedWithCustomError(revenueAutomation, "InvalidPercentage");
        });

        it("Should not allow invalid distribution interval", async function () {
            await expect(
                revenueAutomation.configureAutomation(
                    projectId,
                    true,
                    true,
                    REINVEST_PERCENTAGE,
                    TAX_WITHHOLDING,
                    taxRecipient.address,
                    12 * 60 * 60 // 12 hours
                )
            ).to.be.revertedWithCustomError(revenueAutomation, "InvalidInterval");
        });
    });

    describe("Auto Distribution", function () {
        beforeEach(async function () {
            // Send some revenue
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: ethers.parseEther("10")
            });
        });

        it("Should execute auto distribution", async function () {
            await expect(revenueAutomation.executeAutoDistribution(projectId))
                .to.emit(revenueAutomation, "AutoDistributionExecuted")
                .withArgs(projectId, ethers.parseEther("10"), anyValue);
        });

        it("Should not allow distribution too soon", async function () {
            await revenueAutomation.executeAutoDistribution(projectId);
            await expect(
                revenueAutomation.executeAutoDistribution(projectId)
            ).to.be.revertedWithCustomError(revenueAutomation, "DistributionTooSoon");
        });

        it("Should allow distribution after interval", async function () {
            await revenueAutomation.executeAutoDistribution(projectId);
            await time.increase(DISTRIBUTION_INTERVAL + 1);
            await expect(revenueAutomation.executeAutoDistribution(projectId))
                .to.emit(revenueAutomation, "AutoDistributionExecuted")
                .withArgs(projectId, ethers.parseEther("10"), anyValue);
        });
    });

    describe("Auto Reinvestment", function () {
        beforeEach(async function () {
            // Send some revenue and process distribution
            await revenueDistributor.connect(projectOwner).receiveRevenue(projectId, {
                value: ethers.parseEther("10")
            });
            await revenueAutomation.executeAutoDistribution(projectId);
            await time.increase(DISTRIBUTION_INTERVAL + 1);

            // Approve RevenueAutomation to handle funds
            await revenueDistributor.connect(investor1).approve(await revenueAutomation.getAddress(), true);

            // Send ETH to RevenueAutomation for transfers
            await owner.sendTransaction({
                to: await revenueAutomation.getAddress(),
                value: ethers.parseEther("10")
            });
        });

        it("Should execute auto reinvestment", async function () {
            const initialBalance = await ethers.provider.getBalance(investor1.address);
            const initialTaxBalance = await ethers.provider.getBalance(taxRecipient.address);

            // Get the latest distribution ID
            const distributionId = await revenueDistributor.distributionCount() - 1n;

            // Calculate investor's share (50% of 10 ETH = 5 ETH)
            const totalAmount = ethers.parseEther("10");
            const investorShare = (totalAmount * 50n) / 100n; // 50% based on token balance

            await revenueAutomation.executeAutoReinvestment(projectId, investor1.address);

            const finalBalance = await ethers.provider.getBalance(investor1.address);
            const finalTaxBalance = await ethers.provider.getBalance(taxRecipient.address);

            // Calculate expected amounts based on investor's share
            const reinvestAmount = (investorShare * BigInt(REINVEST_PERCENTAGE)) / 10000n;
            const taxAmount = (investorShare * BigInt(TAX_WITHHOLDING)) / 10000n;
            const netAmount = investorShare - reinvestAmount - taxAmount;

            expect(finalBalance - initialBalance).to.equal(netAmount);
            expect(finalTaxBalance - initialTaxBalance).to.equal(taxAmount);
        });

        it("Should update tax withholding", async function () {
            await time.increase(DISTRIBUTION_INTERVAL + 1);
            await revenueAutomation.executeAutoDistribution(projectId);
            await time.increase(DISTRIBUTION_INTERVAL + 1);

            // Approve RevenueAutomation to handle funds
            await revenueDistributor.connect(investor1).approve(await revenueAutomation.getAddress(), true);

            // Send ETH to RevenueAutomation for transfers
            await owner.sendTransaction({
                to: await revenueAutomation.getAddress(),
                value: ethers.parseEther("10")
            });

            await revenueAutomation.executeAutoReinvestment(projectId, investor1.address);

            const taxWithholding = await revenueAutomation.getInvestorTaxWithholding(investor1.address, projectId);
            expect(taxWithholding).to.be.gt(0);
        });
    });

    describe("Security", function () {
        it("Should only allow owner to configure automation", async function () {
            await expect(
                revenueAutomation.connect(investor1).configureAutomation(
                    projectId,
                    true,
                    true,
                    REINVEST_PERCENTAGE,
                    TAX_WITHHOLDING,
                    taxRecipient.address,
                    DISTRIBUTION_INTERVAL
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should not allow operations when paused", async function () {
            await revenueAutomation.pause();
            await expect(
                revenueAutomation.executeAutoDistribution(projectId)
            ).to.be.revertedWith("Pausable: paused");
        });
    });
}); 