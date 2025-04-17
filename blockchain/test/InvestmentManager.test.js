const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InvestmentManager", function () {
  let AssetToken;
  let ProjectRegistry;
  let InvestmentManager;
  let assetToken;
  let projectRegistry;
  let investmentManager;
  let owner;
  let investor1;
  let investor2;
  let nonVerifiedInvestor;
  const PROJECT_ID = 0;
  const INVESTMENT_AMOUNT = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, investor1, investor2, nonVerifiedInvestor] = await ethers.getSigners();

    // Deploy AssetToken
    AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy("Energy Asset Token", "EAT");
    await assetToken.waitForDeployment();

    // Deploy ProjectRegistry
    ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy();
    await projectRegistry.waitForDeployment();

    // Deploy InvestmentManager
    InvestmentManager = await ethers.getContractFactory("InvestmentManager");
    investmentManager = await InvestmentManager.deploy(
      await assetToken.getAddress(),
      await projectRegistry.getAddress()
    );
    await investmentManager.waitForDeployment();

    // Setup permissions
    await assetToken.setMinter(await investmentManager.getAddress());

    // Register a test project
    await projectRegistry.registerProject("Test Project", 1000, "Test Location");
    await projectRegistry.updateProjectStatus(PROJECT_ID, 1); // Set to Active

    // Verify KYC for investors
    await projectRegistry.verifyKYC(investor1.address);
    await projectRegistry.verifyKYC(investor2.address);
  });

  describe("Deployment", function () {
    it("Should set the correct AssetToken address", async function () {
      expect(await investmentManager.assetToken()).to.equal(
        await assetToken.getAddress()
      );
    });

    it("Should set the correct ProjectRegistry address", async function () {
      expect(await investmentManager.projectRegistry()).to.equal(
        await projectRegistry.getAddress()
      );
    });

    it("Should set the right owner", async function () {
      expect(await investmentManager.owner()).to.equal(owner.address);
    });
  });

  describe("Investment", function () {
    it("Should allow investment with valid parameters", async function () {
      await expect(
        investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
          value: INVESTMENT_AMOUNT,
        })
      )
        .to.emit(investmentManager, "InvestmentMade")
        .withArgs(PROJECT_ID, investor1.address, INVESTMENT_AMOUNT, INVESTMENT_AMOUNT);

      const [totalInvested, tokenBalance, ] = await investmentManager.getInvestmentDetails(
        PROJECT_ID,
        investor1.address
      );
      expect(totalInvested).to.equal(INVESTMENT_AMOUNT);
      expect(tokenBalance).to.equal(INVESTMENT_AMOUNT);
    });

    it("Should mint correct amount of tokens", async function () {
      await investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
        value: INVESTMENT_AMOUNT,
      });
      expect(await assetToken.balanceOf(investor1.address)).to.equal(INVESTMENT_AMOUNT);
    });

    it("Should revert if project does not exist", async function () {
      await expect(
        investmentManager.connect(investor1).makeInvestment(99, {
          value: INVESTMENT_AMOUNT,
        })
      ).to.be.revertedWithCustomError(projectRegistry, "ProjectDoesNotExist");
    });

    it("Should revert if project is not active", async function () {
      await projectRegistry.updateProjectStatus(PROJECT_ID, 2); // Set to Completed
      await expect(
        investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
          value: INVESTMENT_AMOUNT,
        })
      ).to.be.revertedWith("Project is not active");
    });

    it("Should revert if investor is not KYC verified", async function () {
      await expect(
        investmentManager.connect(nonVerifiedInvestor).makeInvestment(PROJECT_ID, {
          value: INVESTMENT_AMOUNT,
        })
      ).to.be.revertedWith("Investor not KYC verified");
    });

    it("Should revert if investment amount is zero", async function () {
      await expect(
        investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
          value: 0,
        })
      ).to.be.revertedWith("Investment amount must be greater than 0");
    });
  });

  describe("Investment Withdrawal", function () {
    beforeEach(async function () {
      await investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
        value: INVESTMENT_AMOUNT,
      });
    });

    it("Should allow withdrawal of investment", async function () {
      await expect(
        investmentManager.connect(investor1).withdrawInvestment(PROJECT_ID, INVESTMENT_AMOUNT)
      )
        .to.emit(investmentManager, "InvestmentWithdrawn")
        .withArgs(PROJECT_ID, investor1.address, INVESTMENT_AMOUNT);

      const [, tokenBalance, ] = await investmentManager.getInvestmentDetails(
        PROJECT_ID,
        investor1.address
      );
      expect(tokenBalance).to.equal(0);
    });

    it("Should burn tokens on withdrawal", async function () {
      await investmentManager.connect(investor1).withdrawInvestment(PROJECT_ID, INVESTMENT_AMOUNT);
      expect(await assetToken.balanceOf(investor1.address)).to.equal(0);
    });

    it("Should revert if withdrawal amount exceeds balance", async function () {
      const excessAmount = INVESTMENT_AMOUNT * 2n;
      await expect(
        investmentManager.connect(investor1).withdrawInvestment(PROJECT_ID, excessAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert if project does not exist", async function () {
      await expect(
        investmentManager.connect(investor1).withdrawInvestment(99, INVESTMENT_AMOUNT)
      ).to.be.revertedWithCustomError(projectRegistry, "ProjectDoesNotExist");
    });
  });

  describe("Investment Details", function () {
    beforeEach(async function () {
      await investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
        value: INVESTMENT_AMOUNT,
      });
    });

    it("Should return correct investment details", async function () {
      const [totalInvested, tokenBalance, lastInvestmentTime] = await investmentManager.getInvestmentDetails(
        PROJECT_ID,
        investor1.address
      );

      expect(totalInvested).to.equal(INVESTMENT_AMOUNT);
      expect(tokenBalance).to.equal(INVESTMENT_AMOUNT);
      expect(lastInvestmentTime).to.be.greaterThan(0);
    });

    it("Should handle multiple investments", async function () {
      await investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
        value: INVESTMENT_AMOUNT,
      });

      const [totalInvested, tokenBalance, ] = await investmentManager.getInvestmentDetails(
        PROJECT_ID,
        investor1.address
      );

      expect(totalInvested).to.equal(INVESTMENT_AMOUNT * 2n);
      expect(tokenBalance).to.equal(INVESTMENT_AMOUNT * 2n);
    });

    it("Should return zero for non-existent investments", async function () {
      const [totalInvested, tokenBalance, lastInvestmentTime] = await investmentManager.getInvestmentDetails(
        PROJECT_ID,
        investor2.address
      );

      expect(totalInvested).to.equal(0);
      expect(tokenBalance).to.equal(0);
      expect(lastInvestmentTime).to.equal(0);
    });
  });

  describe("Pause/Unpause", function () {
    it("Should not allow investments when paused", async function () {
      await investmentManager.pause();
      await expect(
        investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
          value: INVESTMENT_AMOUNT,
        })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow withdrawals when paused", async function () {
      await investmentManager.connect(investor1).makeInvestment(PROJECT_ID, {
        value: INVESTMENT_AMOUNT,
      });
      await investmentManager.pause();
      await expect(
        investmentManager.connect(investor1).withdrawInvestment(PROJECT_ID, INVESTMENT_AMOUNT)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should allow only owner to pause/unpause", async function () {
      await expect(
        investmentManager.connect(investor1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await investmentManager.pause();
      await expect(
        investmentManager.connect(investor1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 