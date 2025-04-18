const { ethers } = require("hardhat");
const { expect } = require("chai");
const { expectRevertWithError, expectEmit, compareBigNumber } = require("./helpers/assertions");

describe("Marketplace", function () {
    let marketplace;
    let projectRegistry;
    let assetToken;
    let owner;
    let seller;
    let buyer;
    let projectId;
    
    const FEE_PERCENTAGE = 250n; // 2.5%
    const PRICE = ethers.parseEther("1");
    const AMOUNT = 100n;
    
    beforeEach(async function () {
        [owner, seller, buyer] = await ethers.getSigners();
        
        // Deploy ProjectRegistry
        const ProjectRegistry = await ethers.getContractFactory("ProjectRegistry");
        projectRegistry = await ProjectRegistry.deploy();
        await projectRegistry.waitForDeployment();
        
        // Deploy AssetToken
        const AssetToken = await ethers.getContractFactory("AssetToken");
        assetToken = await AssetToken.deploy("Test Token", "TEST");
        await assetToken.waitForDeployment();
        
        // Deploy Marketplace
        const Marketplace = await ethers.getContractFactory("Marketplace");
        marketplace = await Marketplace.deploy(
            await owner.getAddress(), // Fee collector address
            await projectRegistry.getAddress() // ProjectRegistry address
        );
        await marketplace.waitForDeployment();
        
        // Set fee percentage
        await marketplace.setFeePercentage(FEE_PERCENTAGE);
        
        // Register project
        const tx = await projectRegistry.registerProject(
            "Test Project",
            "Test Description",
            ethers.parseEther("100"), // targetAmount
            ethers.parseEther("0.1"), // minInvestment
            ethers.parseEther("10"), // maxInvestment
            await assetToken.getAddress() // tokenAddress
        );
        const receipt = await tx.wait();
        
        // Get project ID from event
        const event = receipt.logs.find(
            log => log.fragment && log.fragment.name === 'ProjectRegistered'
        );
        projectId = event.args.projectId;
        
        // Verify KYC for seller
        await projectRegistry.verifyKYC(await seller.getAddress());
        
        // Set owner as minter
        await assetToken.setMinter(await owner.getAddress());
        
        // Mint tokens to seller
        await assetToken.mint(await seller.getAddress(), AMOUNT);
        
        // Set project status to Active (1)
        await projectRegistry.updateProjectStatus(projectId, 1);
        
        // Approve marketplace to transfer tokens
        await assetToken.connect(seller).approve(await marketplace.getAddress(), AMOUNT);
    });
    
    describe("Listings", function () {
        it("should create a listing successfully", async function () {
            const duration = 86400n; // 1 day
            
            const tx = await marketplace.connect(seller).createListing(
                projectId,
                AMOUNT,
                PRICE,
                duration
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(
                log => log.fragment && log.fragment.name === 'ListingCreated'
            );
            
            expect(event).to.not.be.undefined;
            expect(event.args.listingId).to.equal(0n);
            expect(event.args.projectId).to.equal(projectId);
            expect(event.args.seller).to.equal(await seller.getAddress());
            expect(event.args.tokenAmount).to.equal(AMOUNT);
            expect(event.args.pricePerToken).to.equal(PRICE);
            
            const listing = await marketplace.listings(0);
            expect(listing.seller).to.equal(await seller.getAddress());
            expect(listing.projectId).to.equal(projectId);
            expect(listing.tokenAmount).to.equal(AMOUNT);
            expect(listing.pricePerToken).to.equal(PRICE);
        });
        
        it("should fail to create a listing with invalid price", async function () {
            await expectRevertWithError(
                marketplace.connect(seller).createListing(projectId, AMOUNT, 0n, 86400n),
                "InvalidPrice"
            );
        });
        
        it("should fail to create a listing with invalid amount", async function () {
            await expectRevertWithError(
                marketplace.connect(seller).createListing(projectId, 0n, PRICE, 86400n),
                "InvalidAmount"
            );
        });
        
        it("should fail to create a listing for inactive project", async function () {
            // Set project status back to Pending (0)
            await projectRegistry.updateProjectStatus(projectId, 0);
            
            await expectRevertWithError(
                marketplace.connect(seller).createListing(projectId, AMOUNT, PRICE, 86400n),
                "InvalidProject"
            );
        });
        
        it("should fail to create a listing without token approval", async function () {
            // Revoke approval
            await assetToken.connect(seller).approve(await marketplace.getAddress(), 0);
            
            await expectRevertWithError(
                marketplace.connect(seller).createListing(projectId, AMOUNT, PRICE, 86400n),
                "TokenNotApproved"
            );
        });
    });
});