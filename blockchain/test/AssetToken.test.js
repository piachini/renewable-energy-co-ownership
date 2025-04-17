const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetToken", function () {
  let AssetToken;
  let token;
  let owner;
  let minter;
  let addr1;
  let addr2;
  const INITIAL_SUPPLY = ethers.parseEther("1000");
  const DIVIDEND_AMOUNT = ethers.parseEther("1");

  beforeEach(async function () {
    [owner, minter, addr1, addr2] = await ethers.getSigners();
    AssetToken = await ethers.getContractFactory("AssetToken");
    token = await AssetToken.deploy("Energy Asset Token", "EAT");
    await token.waitForDeployment();
    await token.setMinter(minter.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should set the right name and symbol", async function () {
      expect(await token.name()).to.equal("Energy Asset Token");
      expect(await token.symbol()).to.equal("EAT");
    });

    it("Should set the right minter", async function () {
      expect(await token.minter()).to.equal(minter.address);
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await token.connect(minter).mint(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(amount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const amount = ethers.parseEther("100");
      await expect(
        token.connect(addr1).mint(addr2.address, amount)
      ).to.be.revertedWithCustomError(token, "OnlyMinter");
    });

    it("Should not allow minting when paused", async function () {
      await token.pause();
      const amount = ethers.parseEther("100");
      await expect(
        token.connect(minter).mint(addr1.address, amount)
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.connect(minter).mint(addr1.address, ethers.parseEther("100"));
    });

    it("Should allow minter to burn tokens", async function () {
      const amount = ethers.parseEther("50");
      await token.connect(minter).burn(addr1.address, amount);
      expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should not allow non-minter to burn tokens", async function () {
      const amount = ethers.parseEther("50");
      await expect(
        token.connect(addr1).burn(addr1.address, amount)
      ).to.be.revertedWithCustomError(token, "OnlyMinter");
    });

    it("Should not allow burning more than balance", async function () {
      const amount = ethers.parseEther("150");
      await expect(
        token.connect(minter).burn(addr1.address, amount)
      ).to.be.revertedWithCustomError(token, "InsufficientBalance");
    });
  });

  describe("Dividends", function () {
    it("Should distribute dividends correctly", async function () {
      // Mint tokens first
      await token.connect(minter).mint(addr1.address, ethers.parseEther("75"));
      await token.connect(minter).mint(addr2.address, ethers.parseEther("25"));

      const dividendAmount = ethers.parseEther("10");
      await token.distributeDividends({ value: dividendAmount });
      
      expect(await token.getTotalDividends()).to.equal(dividendAmount);
      const addr1Claimable = await token.getClaimableDividends(addr1.address);
      const addr2Claimable = await token.getClaimableDividends(addr2.address);
      expect(addr1Claimable).to.equal(ethers.parseEther("7.5"));
      expect(addr2Claimable).to.equal(ethers.parseEther("2.5"));
    });

    it("Should allow claiming dividends", async function () {
      // Mint tokens first
      await token.connect(minter).mint(addr1.address, ethers.parseEther("75"));
      await token.connect(minter).mint(addr2.address, ethers.parseEther("25"));

      const dividendAmount = ethers.parseEther("10");
      await token.distributeDividends({ value: dividendAmount });

      const balanceBefore = await ethers.provider.getBalance(addr1);
      const tx = await token.connect(addr1).claimDividends();
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;
      const balanceAfter = await ethers.provider.getBalance(addr1);

      const expectedDividend = ethers.parseEther("7.5");
      const actualChange = balanceAfter - balanceBefore + gasCost;
      
      expect(actualChange).to.equal(expectedDividend);
    });

    it("Should not allow claiming when no dividends available", async function () {
      await expect(
        token.connect(addr1).claimDividends()
      ).to.be.revertedWithCustomError(token, "NoDividendsToClaim");
    });

    it("should update dividend info correctly upon transfer", async function () {
      // Mint tokens to addr1
      await token.connect(minter).mint(addr1.address, ethers.parseEther("100"));
      
      // Distribute initial dividends
      await token.distributeDividends({ value: ethers.parseEther("1.0") });
      
      // Transfer half tokens from addr1 to addr2
      await token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
      
      // Check claimable dividends for both addresses
      const addr1Claimable = await token.getClaimableDividends(addr1.address);
      const addr2Claimable = await token.getClaimableDividends(addr2.address);
      
      // addr1 should have half of their original dividends (0.5 ETH)
      // addr2 should have received half of addr1's dividends (0.5 ETH)
      expect(addr1Claimable).to.equal(ethers.parseEther("0.5"));
      expect(addr2Claimable).to.equal(ethers.parseEther("0.5"));
      
      // Distribute more dividends
      await token.distributeDividends({ value: ethers.parseEther("1.0") });
      
      // Check updated claimable dividends
      const addr1ClaimableNew = await token.getClaimableDividends(addr1.address);
      const addr2ClaimableNew = await token.getClaimableDividends(addr2.address);
      
      // Each address should have their previous dividends plus half of the new dividends
      expect(addr1ClaimableNew).to.equal(ethers.parseEther("1.0")); // 0.5 from before + 0.5 from new
      expect(addr2ClaimableNew).to.equal(ethers.parseEther("1.0")); // 0.5 from before + 0.5 from new
    });
  });

  describe("Pause/Unpause", function () {
    beforeEach(async function () {
      await token.connect(minter).mint(addr1.address, ethers.parseEther("100"));
    });

    it("Should allow owner to pause and unpause", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;
      
      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        token.connect(addr1).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should not allow transfers when paused", async function () {
      const amount = ethers.parseEther("50");
      await token.pause();
      await expect(
        token.connect(addr1).transfer(addr2.address, amount)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow minting when paused", async function () {
      await token.pause();
      await expect(
        token.connect(minter).mint(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow burning when paused", async function () {
      await token.pause();
      await expect(
        token.connect(minter).burn(addr1.address, ethers.parseEther("50"))
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow dividend distribution when paused", async function () {
      await token.pause();
      await expect(
        token.distributeDividends({ value: ethers.parseEther("1") })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow dividend claiming when paused", async function () {
      await token.distributeDividends({ value: ethers.parseEther("1") });
      await token.pause();
      await expect(
        token.connect(addr1).claimDividends()
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Transfer Behavior", function () {
    beforeEach(async function () {
      await token.connect(minter).mint(addr1.address, INITIAL_SUPPLY);
      await token.distributeDividends({ value: DIVIDEND_AMOUNT });
    });

    it("Should maintain dividend credits after transfer", async function () {
      const transferAmount = INITIAL_SUPPLY / 2n;
      
      // Claim dividends before transfer
      await token.connect(addr1).claimDividends();
      
      // Transfer tokens
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      
      // Distribute new dividends
      await token.distributeDividends({ value: DIVIDEND_AMOUNT });

      const addr1Claimable = await token.getClaimableDividends(addr1.address);
      const addr2Claimable = await token.getClaimableDividends(addr2.address);

      expect(addr1Claimable).to.equal(DIVIDEND_AMOUNT / 2n);
      expect(addr2Claimable).to.equal(DIVIDEND_AMOUNT / 2n);
    });

    it("Should handle multiple transfers and distributions", async function () {
      const transferAmount = INITIAL_SUPPLY / 2n;
      
      // Claim initial dividends
      await token.connect(addr1).claimDividends();
      
      // Transfer and distribute new dividends
      await token.connect(addr1).transfer(addr2.address, transferAmount);
      await token.distributeDividends({ value: DIVIDEND_AMOUNT });

      const addr1Claimable = await token.getClaimableDividends(addr1.address);
      const addr2Claimable = await token.getClaimableDividends(addr2.address);

      expect(addr1Claimable).to.equal(DIVIDEND_AMOUNT / 2n);
      expect(addr2Claimable).to.equal(DIVIDEND_AMOUNT / 2n);
    });
  });

  describe("Receive Function", function () {
    it("Should handle direct ETH transfers as dividends", async function () {
      // Mint some tokens first
      await token.connect(minter).mint(addr1.address, ethers.parseEther("100"));
      
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: DIVIDEND_AMOUNT
      });
      
      expect(await token.getTotalDividends()).to.equal(DIVIDEND_AMOUNT);
    });
  });
}); 