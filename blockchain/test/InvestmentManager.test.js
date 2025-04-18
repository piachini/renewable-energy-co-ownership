const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevertWithError } = require("./helpers/assertions");

describe("InvestmentManager", function () {
  let investmentManager;
  let projectRegistry;
  let assetToken;
  let owner;
  let investor;
  let projectOwner;
  let feeCollector;
  
  const PROJECT_NAME = "Solar Plant Rome";
  const PROJECT_DESCRIPTION = "500kW Solar Plant";
  const TARGET_AMOUNT = ethers.parseEther("1000");
  const MIN_INVESTMENT = ethers.parseEther("0.1");
  const MAX_INVESTMENT = ethers.parseEther("100");
  const INVESTMENT_AMOUNT = ethers.parseEther("1");
  const FEE_PERCENTAGE = 250n; // 2.5%
  
  beforeEach(async function () {
    [owner, investor, projectOwner, feeCollector] = await ethers.getSigners();
    
    // Deploy ProjectRegistry
    const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy();
    
    // Deploy AssetToken
    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy("Energy Asset Token", "EAT");
    
    // Deploy InvestmentManager
    const InvestmentManager = await ethers.getContractFactory("InvestmentManager");
    investmentManager = await InvestmentManager.deploy(
      await assetToken.getAddress(),
      await projectRegistry.getAddress()
    );
    
    // Set InvestmentManager as minter for AssetToken
    await assetToken.setMinter(await investmentManager.getAddress());
    
    // Register a project
    await projectRegistry.connect(projectOwner).registerProject(
      PROJECT_NAME,
      PROJECT_DESCRIPTION,
      TARGET_AMOUNT,
      MIN_INVESTMENT,
      MAX_INVESTMENT,
      await assetToken.getAddress()
    );
    
    // Verify KYC for investor
    await projectRegistry.connect(owner).verifyKYC(investor.address);
    
    // Set project status to Active
    await projectRegistry.connect(projectOwner).updateProjectStatus(0, 1);
  });
  
  describe("Initialization", function () {
    it("should set the correct ProjectRegistry address", async function () {
      expect(await investmentManager.projectRegistry()).to.equal(await projectRegistry.getAddress());
    });
    
    it("should set the correct AssetToken address", async function () {
      expect(await investmentManager.assetToken()).to.equal(await assetToken.getAddress());
    });
  });
  
  describe("Investment", function () {
    it("should allow investment with valid parameters", async function () {
      await expect(investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT }))
        .to.emit(investmentManager, "InvestmentMade")
        .withArgs(0, investor.address, INVESTMENT_AMOUNT, INVESTMENT_AMOUNT);
      
      const [totalInvested] = await investmentManager.getInvestmentDetails(0, investor.address);
      expect(totalInvested).to.equal(INVESTMENT_AMOUNT);
    });
    
    it("should mint the correct amount of tokens", async function () {
      await investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT });
      expect(await assetToken.balanceOf(investor.address)).to.equal(INVESTMENT_AMOUNT);
    });
    
    it("should fail if project does not exist", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(99, { value: INVESTMENT_AMOUNT }),
        "ProjectDoesNotExist"
      );
    });
    
    it("should fail if project is not active", async function () {
      await projectRegistry.connect(projectOwner).updateProjectStatus(0, 2); // Completed
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT }),
        "ProjectNotActive"
      );
    });
    
    it("should fail if investor is not KYC verified", async function () {
      const [, , , , nonVerifiedInvestor] = await ethers.getSigners();
      await expectRevertWithError(
        investmentManager.connect(nonVerifiedInvestor).makeInvestment(0, { value: INVESTMENT_AMOUNT }),
        "InvestorNotVerified"
      );
    });
    
    it("should fail if amount is zero", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(0, { value: 0 }),
        "InvalidAmount"
      );
    });
    
    it("should fail if amount is below minimum", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(0, { value: ethers.parseEther("0.01") }),
        "AmountBelowMinimum"
      );
    });
    
    it("should fail if amount is above maximum", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(0, { value: ethers.parseEther("101") }),
        "AmountAboveMaximum"
      );
    });
  });
  
  describe("Investment Withdrawal", function () {
    beforeEach(async function () {
      await investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT });
    });
    
    it("should allow investment withdrawal", async function () {
      await expect(investmentManager.connect(investor).withdrawInvestment(0, INVESTMENT_AMOUNT))
        .to.emit(investmentManager, "InvestmentWithdrawn")
        .withArgs(0, investor.address, INVESTMENT_AMOUNT);
      
      const [totalInvested] = await investmentManager.getInvestmentDetails(0, investor.address);
      expect(totalInvested).to.equal(0);
    });
    
    it("should burn tokens on withdrawal", async function () {
      await investmentManager.connect(investor).withdrawInvestment(0, INVESTMENT_AMOUNT);
      expect(await assetToken.balanceOf(investor.address)).to.equal(0);
    });
    
    it("should fail if amount exceeds balance", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).withdrawInvestment(0, INVESTMENT_AMOUNT + 1n),
        "InsufficientBalance"
      );
    });
    
    it("should fail if project does not exist", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).withdrawInvestment(99, INVESTMENT_AMOUNT),
        "ProjectDoesNotExist"
      );
    });
  });
  
  describe("Investment Details", function () {
    beforeEach(async function () {
      await investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT });
    });
    
    it("should return correct investment details", async function () {
      const [totalInvested, tokenBalance, lastInvestmentTime] = await investmentManager.getInvestmentDetails(0, investor.address);
      expect(totalInvested).to.equal(INVESTMENT_AMOUNT);
      expect(tokenBalance).to.equal(INVESTMENT_AMOUNT);
      expect(lastInvestmentTime).to.be.gt(0);
    });
    
    it("should handle multiple investments", async function () {
      await investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT });
      const [totalInvested] = await investmentManager.getInvestmentDetails(0, investor.address);
      expect(totalInvested).to.equal(INVESTMENT_AMOUNT * 2n);
    });
    
    it("should return zero for non-existent investments", async function () {
      const [, , , , nonInvestor] = await ethers.getSigners();
      const [totalInvested] = await investmentManager.getInvestmentDetails(0, nonInvestor.address);
      expect(totalInvested).to.equal(0);
    });
  });
  
  describe("Pause", function () {
    it("should prevent investments when paused", async function () {
      await investmentManager.connect(owner).pause();
      await expectRevertWithError(
        investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT }),
        "Pausable: paused"
      );
    });
    
    it("should prevent withdrawals when paused", async function () {
      await investmentManager.connect(investor).makeInvestment(0, { value: INVESTMENT_AMOUNT });
      await investmentManager.connect(owner).pause();
      await expectRevertWithError(
        investmentManager.connect(investor).withdrawInvestment(0, INVESTMENT_AMOUNT),
        "Pausable: paused"
      );
    });
    
    it("should only allow owner to pause/unpause", async function () {
      await expectRevertWithError(
        investmentManager.connect(investor).pause(),
        "Ownable: caller is not the owner"
      );
      
      await investmentManager.connect(owner).pause();
      await expectRevertWithError(
        investmentManager.connect(investor).unpause(),
        "Ownable: caller is not the owner"
      );
    });
  });
}); 