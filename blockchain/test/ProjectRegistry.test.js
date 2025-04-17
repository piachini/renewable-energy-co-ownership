const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ProjectRegistry", function () {
  let ProjectRegistry;
  let registry;
  let owner;
  let addr1;
  let addr2;
  let timestamp;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
    registry = await ProjectRegistry.deploy();
    await registry.waitForDeployment();
    timestamp = Math.floor(Date.now() / 1000);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("Should start with zero projects", async function () {
      expect(await registry.projectCount()).to.equal(0);
    });
  });

  describe("Project Registration", function () {
    const validProject = {
      name: "Solar Farm Alpha",
      capacity: 1000,
      location: "Texas, USA"
    };

    it("Should register a new project with valid parameters", async function () {
      await expect(registry.registerProject(validProject.name, validProject.capacity, validProject.location))
        .to.emit(registry, "ProjectRegistered")
        .withArgs(0, validProject.name, owner.address);

      const project = await registry.getProjectDetails(0);
      expect(project.name).to.equal(validProject.name);
      expect(project.capacity).to.equal(validProject.capacity);
      expect(project.location).to.equal(validProject.location);
      expect(project.owner).to.equal(owner.address);
      expect(project.status).to.equal(0); // Pending
    });

    it("Should increment project count after registration", async function () {
      await registry.registerProject(validProject.name, validProject.capacity, validProject.location);
      expect(await registry.projectCount()).to.equal(1);
    });

    it("Should revert when registering with empty name", async function () {
      await expect(
        registry.registerProject("", validProject.capacity, validProject.location)
      ).to.be.revertedWithCustomError(registry, "EmptyName");
    });

    it("Should revert when registering with empty location", async function () {
      await expect(
        registry.registerProject(validProject.name, validProject.capacity, "")
      ).to.be.revertedWithCustomError(registry, "EmptyLocation");
    });

    it("Should revert when registering with zero capacity", async function () {
      await expect(
        registry.registerProject(validProject.name, 0, validProject.location)
      ).to.be.revertedWithCustomError(registry, "ZeroCapacity");
    });

    it("Should not allow registration when paused", async function () {
      await registry.pause();
      await expect(
        registry.registerProject(validProject.name, validProject.capacity, validProject.location)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Project Status Updates", function () {
    beforeEach(async function () {
      await registry.registerProject("Test Project", 1000, "Test Location");
    });

    it("Should allow owner to update project status", async function () {
      await expect(registry.updateProjectStatus(0, 1))
        .to.emit(registry, "ProjectStatusUpdated")
        .withArgs(0, 1);

      const project = await registry.getProjectDetails(0);
      expect(project.status).to.equal(1); // Active
    });

    it("Should not allow non-owner to update project status", async function () {
      await expect(
        registry.connect(addr1).updateProjectStatus(0, 1)
      ).to.be.revertedWith("Not project owner");
    });

    it("Should revert when updating non-existent project", async function () {
      await expect(
        registry.updateProjectStatus(99, 1)
      ).to.be.revertedWithCustomError(registry, "ProjectDoesNotExist");
    });

    it("Should revert when setting invalid status", async function () {
      await expect(
        registry.updateProjectStatus(0, 4)
      ).to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should not allow updating completed projects", async function () {
      await registry.updateProjectStatus(0, 2); // Set to Completed
      await expect(
        registry.updateProjectStatus(0, 1)
      ).to.be.revertedWithCustomError(registry, "ProjectCompleted");
    });

    it("Should not allow updating cancelled projects", async function () {
      await registry.updateProjectStatus(0, 3); // Set to Cancelled
      await expect(
        registry.updateProjectStatus(0, 1)
      ).to.be.revertedWith("Project cancelled");
    });
  });

  describe("KYC Verification", function () {
    it("Should allow owner to verify KYC", async function () {
      await expect(registry.verifyKYC(addr1.address))
        .to.emit(registry, "KYCVerified")
        .withArgs(addr1.address);

      expect(await registry.isKYCVerified(addr1.address)).to.be.true;
    });

    it("Should not allow non-owner to verify KYC", async function () {
      await expect(
        registry.connect(addr1).verifyKYC(addr2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert when verifying zero address", async function () {
      await expect(
        registry.verifyKYC(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("Should revert when verifying already verified address", async function () {
      await registry.verifyKYC(addr1.address);
      await expect(
        registry.verifyKYC(addr1.address)
      ).to.be.revertedWithCustomError(registry, "AlreadyVerified");
    });
  });

  describe("Project Details", function () {
    beforeEach(async function () {
      await registry.registerProject("Test Project", 1000, "Test Location");
    });

    it("Should return correct project details", async function () {
      const project = await registry.getProjectDetails(0);
      expect(project.id).to.equal(0);
      expect(project.name).to.equal("Test Project");
      expect(project.capacity).to.equal(1000);
      expect(project.location).to.equal("Test Location");
      expect(project.totalInvestment).to.equal(0);
      expect(project.currentInvestment).to.equal(0);
      expect(project.status).to.equal(0);
      expect(project.owner).to.equal(owner.address);
    });

    it("Should revert when querying non-existent project", async function () {
      await expect(
        registry.getProjectDetails(99)
      ).to.be.revertedWithCustomError(registry, "ProjectDoesNotExist");
    });
  });

  describe("Pause/Unpause", function () {
    it("Should allow owner to pause and unpause", async function () {
      await registry.pause();
      expect(await registry.paused()).to.be.true;

      await registry.unpause();
      expect(await registry.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        registry.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow non-owner to unpause", async function () {
      await registry.pause();
      await expect(
        registry.connect(addr1).unpause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
}); 