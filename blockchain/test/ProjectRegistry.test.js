const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevertWithError } = require("./helpers/assertions");

describe("ProjectRegistry", function () {
  let projectRegistry;
  let owner;
  let projectOwner;
  let investor;
  let tokenAddress;
  
  const PROJECT_NAME = "Impianto Solare Roma";
  const PROJECT_DESCRIPTION = "Impianto fotovoltaico da 500kW";
  const TARGET_AMOUNT = ethers.parseEther("1000");
  const MIN_INVESTMENT = ethers.parseEther("0.1");
  const MAX_INVESTMENT = ethers.parseEther("100");
  
  beforeEach(async function () {
    [owner, projectOwner, investor, tokenAddress] = await ethers.getSigners();
    
    const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    projectRegistry = await ProjectRegistry.deploy();
    await projectRegistry.waitForDeployment();
  });
  
  describe("Inizializzazione", function () {
    it("dovrebbe impostare il proprietario corretto", async function () {
      expect(await projectRegistry.owner()).to.equal(owner.address);
    });
    
    it("dovrebbe inizializzare con projectCount a 0", async function () {
      expect(await projectRegistry.projectCount()).to.equal(0);
    });
  });
  
  describe("Registrazione Progetto", function () {
    it("dovrebbe registrare un nuovo progetto correttamente", async function () {
      await expect(projectRegistry.connect(projectOwner).registerProject(
        PROJECT_NAME,
        PROJECT_DESCRIPTION,
        TARGET_AMOUNT,
        MIN_INVESTMENT,
        MAX_INVESTMENT,
        tokenAddress.address
      )).to.emit(projectRegistry, "ProjectRegistered")
        .withArgs(0, PROJECT_NAME, projectOwner.address);
      
      const projectDetails = await projectRegistry.getProjectDetails(0);
      expect(projectDetails.base.name).to.equal(PROJECT_NAME);
      expect(projectDetails.base.description).to.equal(PROJECT_DESCRIPTION);
      expect(projectDetails.base.owner).to.equal(projectOwner.address);
      expect(projectDetails.base.status).to.equal(0); // ProjectStatus.Pending
      
      expect(projectDetails.financials.targetAmount).to.equal(TARGET_AMOUNT);
      expect(projectDetails.financials.minInvestment).to.equal(MIN_INVESTMENT);
      expect(projectDetails.financials.maxInvestment).to.equal(MAX_INVESTMENT);
      
      expect(projectDetails.technical.tokenAddress).to.equal(tokenAddress.address);
    });
    
    it("dovrebbe fallire con nome vuoto", async function () {
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          "",
          PROJECT_DESCRIPTION,
          TARGET_AMOUNT,
          MIN_INVESTMENT,
          MAX_INVESTMENT,
          tokenAddress.address
        ),
        "EmptyName"
      );
    });
    
    it("dovrebbe fallire con descrizione vuota", async function () {
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          PROJECT_NAME,
          "",
          TARGET_AMOUNT,
          MIN_INVESTMENT,
          MAX_INVESTMENT,
          tokenAddress.address
        ),
        "EmptyName"
      );
    });
    
    it("dovrebbe fallire con targetAmount zero", async function () {
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          PROJECT_NAME,
          PROJECT_DESCRIPTION,
          0,
          MIN_INVESTMENT,
          MAX_INVESTMENT,
          tokenAddress.address
        ),
        "ZeroCapacity"
      );
    });
    
    it("dovrebbe fallire con limiti di investimento invalidi", async function () {
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          PROJECT_NAME,
          PROJECT_DESCRIPTION,
          TARGET_AMOUNT,
          0,
          MAX_INVESTMENT,
          tokenAddress.address
        ),
        "InvalidInvestmentLimits"
      );
      
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          PROJECT_NAME,
          PROJECT_DESCRIPTION,
          TARGET_AMOUNT,
          MAX_INVESTMENT,
          MIN_INVESTMENT,
          tokenAddress.address
        ),
        "InvalidInvestmentLimits"
      );
    });
  });
  
  describe("Gestione Stato Progetto", function () {
    beforeEach(async function () {
      await projectRegistry.connect(projectOwner).registerProject(
        PROJECT_NAME,
        PROJECT_DESCRIPTION,
        TARGET_AMOUNT,
        MIN_INVESTMENT,
        MAX_INVESTMENT,
        tokenAddress.address
      );
    });
    
    it("dovrebbe permettere al proprietario di aggiornare lo stato", async function () {
      await expect(projectRegistry.connect(projectOwner).updateProjectStatus(0, 1))
        .to.emit(projectRegistry, "ProjectStatusUpdated")
        .withArgs(0, 1);
        
      const projectDetails = await projectRegistry.getProjectDetails(0);
      expect(projectDetails.base.status).to.equal(1); // ProjectStatus.Active
    });
    
    it("dovrebbe fallire se chiamato da non proprietario", async function () {
      await expectRevertWithError(
        projectRegistry.connect(investor).updateProjectStatus(0, 1),
        "InvalidAddress"
      );
    });
    
    it("dovrebbe fallire con stato invalido", async function () {
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).updateProjectStatus(0, 4),
        "InvalidStatus"
      );
    });
    
    it("dovrebbe fallire per progetti completati", async function () {
      await projectRegistry.connect(projectOwner).updateProjectStatus(0, 2); // Completed
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).updateProjectStatus(0, 1),
        "ProjectCompleted"
      );
    });
  });
  
  describe("Verifica KYC", function () {
    it("dovrebbe permettere al proprietario di verificare un investitore", async function () {
      await expect(projectRegistry.connect(owner).verifyKYC(investor.address))
        .to.emit(projectRegistry, "KYCVerified")
        .withArgs(investor.address);
        
      expect(await projectRegistry.isKYCVerified(investor.address)).to.be.true;
    });
    
    it("dovrebbe fallire se chiamato da non proprietario", async function () {
      await expectRevertWithError(
        projectRegistry.connect(investor).verifyKYC(investor.address),
        "Ownable: caller is not the owner"
      );
    });
    
    it("dovrebbe fallire per indirizzo zero", async function () {
      await expectRevertWithError(
        projectRegistry.connect(owner).verifyKYC(ethers.ZeroAddress),
        "InvalidAddress"
      );
    });
    
    it("dovrebbe fallire per investitore già verificato", async function () {
      await projectRegistry.connect(owner).verifyKYC(investor.address);
      await expectRevertWithError(
        projectRegistry.connect(owner).verifyKYC(investor.address),
        "AlreadyVerified"
      );
    });
  });
  
  describe("Funzioni di Lettura", function () {
    beforeEach(async function () {
      await projectRegistry.connect(projectOwner).registerProject(
        PROJECT_NAME,
        PROJECT_DESCRIPTION,
        TARGET_AMOUNT,
        MIN_INVESTMENT,
        MAX_INVESTMENT,
        tokenAddress.address
      );
    });
    
    it("dovrebbe restituire i dettagli corretti del progetto", async function () {
      const projectDetails = await projectRegistry.getProjectDetails(0);
      expect(projectDetails.base.name).to.equal(PROJECT_NAME);
      expect(projectDetails.base.owner).to.equal(projectOwner.address);
      expect(projectDetails.financials.targetAmount).to.equal(TARGET_AMOUNT);
      expect(projectDetails.technical.tokenAddress).to.equal(tokenAddress.address);
    });
    
    it("dovrebbe fallire per progetto inesistente", async function () {
      await expectRevertWithError(
        projectRegistry.getProjectDetails(99),
        "ProjectDoesNotExist"
      );
    });
    
    it("dovrebbe restituire l'indirizzo del token corretto", async function () {
      expect(await projectRegistry.getProjectToken(0)).to.equal(tokenAddress.address);
    });
  });
  
  describe("Pausa", function () {
    it("dovrebbe permettere al proprietario di mettere in pausa", async function () {
      await projectRegistry.connect(owner).pause();
      expect(await projectRegistry.paused()).to.be.true;
    });
    
    it("dovrebbe permettere al proprietario di riprendere", async function () {
      await projectRegistry.connect(owner).pause();
      await projectRegistry.connect(owner).unpause();
      expect(await projectRegistry.paused()).to.be.false;
    });
    
    it("dovrebbe impedire la registrazione quando in pausa", async function () {
      await projectRegistry.connect(owner).pause();
      await expectRevertWithError(
        projectRegistry.connect(projectOwner).registerProject(
          PROJECT_NAME,
          PROJECT_DESCRIPTION,
          TARGET_AMOUNT,
          MIN_INVESTMENT,
          MAX_INVESTMENT,
          tokenAddress.address
        ),
        "Pausable: paused"
      );
    });
  });
}); 