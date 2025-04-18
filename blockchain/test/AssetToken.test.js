const { expect } = require("chai");
const { ethers } = require("hardhat");
const { expectRevertWithError, expectEmit, compareBigNumber } = require("./helpers/assertions");

describe("AssetToken", function () {
  let assetToken;
  let owner;
  let minter;
  let user1;
  let user2;
  
  const NAME = "Energy Asset Token";
  const SYMBOL = "EAT";
  const INITIAL_SUPPLY = ethers.parseEther("1000");
  
  beforeEach(async function () {
    [owner, minter, user1, user2] = await ethers.getSigners();
    
    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy(NAME, SYMBOL);
    await assetToken.waitForDeployment();
    
    // Imposta il minter
    await assetToken.connect(owner).setMinter(minter.address);
  });
  
  describe("Inizializzazione", function () {
    it("dovrebbe impostare correttamente nome e simbolo", async function () {
      expect(await assetToken.name()).to.equal(NAME);
      expect(await assetToken.symbol()).to.equal(SYMBOL);
    });
    
    it("dovrebbe impostare il proprietario corretto", async function () {
      expect(await assetToken.owner()).to.equal(owner.address);
    });
    
    it("dovrebbe impostare il minter corretto", async function () {
      expect(await assetToken.minter()).to.equal(minter.address);
    });
  });
  
  describe("Minting", function () {
    it("dovrebbe permettere al minter di creare nuovi token", async function () {
      await expect(assetToken.connect(minter).mint(user1.address, INITIAL_SUPPLY))
        .to.emit(assetToken, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, INITIAL_SUPPLY);
      
      expect(await assetToken.balanceOf(user1.address)).to.equal(INITIAL_SUPPLY);
    });
    
    it("dovrebbe fallire se chiamato da un non-minter", async function () {
      await expectRevertWithError(
        assetToken.connect(user1).mint(user2.address, INITIAL_SUPPLY),
        "OnlyMinter"
      );
    });
  });
  
  describe("Burning", function () {
    beforeEach(async function () {
      await assetToken.connect(minter).mint(user1.address, INITIAL_SUPPLY);
    });
    
    it("dovrebbe permettere al minter di bruciare token", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(assetToken.connect(minter).burn(user1.address, burnAmount))
        .to.emit(assetToken, "Transfer")
        .withArgs(user1.address, ethers.ZeroAddress, burnAmount);
      
      expect(await assetToken.balanceOf(user1.address)).to.equal(INITIAL_SUPPLY - burnAmount);
    });
    
    it("dovrebbe fallire se il saldo è insufficiente", async function () {
      await expectRevertWithError(
        assetToken.connect(minter).burn(user1.address, INITIAL_SUPPLY + 1n),
        "InsufficientBalance"
      );
    });
    
    it("dovrebbe fallire se chiamato da un non-minter", async function () {
      await expectRevertWithError(
        assetToken.connect(user1).burn(user1.address, ethers.parseEther("100")),
        "OnlyMinter"
      );
    });
  });
  
  describe("Dividendi", function () {
    beforeEach(async function () {
      await assetToken.connect(minter).mint(user1.address, INITIAL_SUPPLY);
      await assetToken.connect(minter).mint(user2.address, INITIAL_SUPPLY);
    });
    
    it("dovrebbe distribuire correttamente i dividendi", async function () {
      const dividendAmount = ethers.parseEther("1");
      
      await expect(assetToken.connect(user1).distributeDividends({ value: dividendAmount }))
        .to.emit(assetToken, "DividendsDistributed")
        .withArgs(dividendAmount);
      
      const claimableUser1 = await assetToken.getClaimableDividends(user1.address);
      const claimableUser2 = await assetToken.getClaimableDividends(user2.address);
      
      expect(claimableUser1).to.equal(dividendAmount / 2n);
      expect(claimableUser2).to.equal(dividendAmount / 2n);
    });
    
    it("dovrebbe permettere il claim dei dividendi", async function () {
      const dividendAmount = ethers.parseEther("1");
      await assetToken.connect(user1).distributeDividends({ value: dividendAmount });
      
      const claimable = await assetToken.getClaimableDividends(user1.address);
      await expect(assetToken.connect(user1).claimDividends())
        .to.emit(assetToken, "DividendsClaimed")
        .withArgs(user1.address, claimable);
      
      expect(await assetToken.getClaimableDividends(user1.address)).to.equal(0);
    });
    
    it("dovrebbe fallire il claim se non ci sono dividendi", async function () {
      await expectRevertWithError(
        assetToken.connect(user1).claimDividends(),
        "NoDividendsToClaim"
      );
    });
    
    it("dovrebbe distribuire automaticamente i dividendi quando riceve ETH", async function () {
      const dividendAmount = ethers.parseEther("1");
      
      await expect(owner.sendTransaction({
        to: await assetToken.getAddress(),
        value: dividendAmount
      })).to.emit(assetToken, "DividendsDistributed")
        .withArgs(dividendAmount);
    });
  });
  
  describe("Pausa", function () {
    it("dovrebbe permettere al proprietario di mettere in pausa il contratto", async function () {
      await assetToken.connect(owner).pause();
      expect(await assetToken.paused()).to.be.true;
    });
    
    it("dovrebbe permettere al proprietario di riprendere il contratto", async function () {
      await assetToken.connect(owner).pause();
      await assetToken.connect(owner).unpause();
      expect(await assetToken.paused()).to.be.false;
    });
    
    it("dovrebbe impedire il minting quando in pausa", async function () {
      await assetToken.connect(owner).pause();
      await expectRevertWithError(
        assetToken.connect(minter).mint(user1.address, INITIAL_SUPPLY),
        "Pausable: paused"
      );
    });
  });
}); 