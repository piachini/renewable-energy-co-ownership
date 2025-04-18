// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ProjectRegistry.sol";
import "./AssetToken.sol";

contract RevenueDistributor is Ownable, Pausable, ReentrancyGuard {
    struct Distribution {
        uint256 id;
        uint256 projectId;
        uint256 amount;
        uint256 timestamp;
        mapping(address => bool) claimed;
    }

    struct ProjectFees {
        uint256 distributionFee;
        address feeRecipient;
    }

    ProjectRegistry public projectRegistry;
    AssetToken public assetToken;
    mapping(uint256 => Distribution) public distributions;
    mapping(uint256 => ProjectFees) public projectFees;
    mapping(uint256 => uint256) public minDistributionAmount;
    mapping(address => mapping(address => bool)) public approvedClaimers;
    uint256 public distributionCount;

    event RevenueDistributed(uint256 indexed distributionId, uint256 indexed projectId, uint256 amount);
    event RevenueClaimed(uint256 indexed distributionId, address indexed investor, uint256 amount);
    event FeesUpdated(uint256 indexed projectId, uint256 distributionFee, address feeRecipient);
    event MinDistributionAmountUpdated(uint256 indexed projectId, uint256 amount);
    event ClaimerApproved(address indexed investor, address indexed claimer, bool approved);

    error InvalidProject();
    error NoRevenue();
    error AlreadyClaimed();
    error InvalidDistribution();
    error TransferFailed();
    error InvalidFeePercentage();
    error InvalidFeeRecipient();
    error InvalidAmount();
    error NotProjectOwner();
    error InsufficientBalance();
    error InvestorNotVerified();
    error NotApproved();

    constructor(address _projectRegistry, address payable _assetToken) {
        projectRegistry = ProjectRegistry(_projectRegistry);
        assetToken = AssetToken(_assetToken);
    }

    function setProjectFees(uint256 projectId, uint256 distributionFee, address feeRecipient) external onlyOwner {
        if (distributionFee > 1000) revert InvalidFeePercentage(); // Max 10%
        if (feeRecipient == address(0)) revert InvalidFeeRecipient();

        projectFees[projectId] = ProjectFees({
            distributionFee: distributionFee,
            feeRecipient: feeRecipient
        });

        emit FeesUpdated(projectId, distributionFee, feeRecipient);
    }

    function setMinDistributionAmount(uint256 projectId, uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidAmount();
        minDistributionAmount[projectId] = amount;
        emit MinDistributionAmountUpdated(projectId, amount);
    }

    function receiveRevenue(uint256 projectId) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert NoRevenue();

        (
            ProjectRegistry.ProjectBase memory base,
            ,  // financials
            ProjectRegistry.ProjectTechnical memory technical
        ) = projectRegistry.getProjectDetails(projectId);

        if (base.status != ProjectRegistry.ProjectStatus.Active) revert InvalidProject();

        uint256 distributionId = distributionCount++;
        Distribution storage distribution = distributions[distributionId];
        distribution.id = distributionId;
        distribution.projectId = projectId;
        
        // Calculate and transfer fee
        ProjectFees memory fees = projectFees[projectId];
        uint256 feeAmount = (msg.value * fees.distributionFee) / 10000;
        distribution.amount = msg.value - feeAmount;
        distribution.timestamp = block.timestamp;

        if (feeAmount > 0 && fees.feeRecipient != address(0)) {
            (bool success, ) = payable(fees.feeRecipient).call{value: feeAmount}("");
            if (!success) revert TransferFailed();
        }

        emit RevenueDistributed(distributionId, projectId, msg.value);
    }

    function processDistributions(uint256 projectId) external whenNotPaused nonReentrant {
        (
            ProjectRegistry.ProjectBase memory base,
            ,
            ProjectRegistry.ProjectTechnical memory technical
        ) = projectRegistry.getProjectDetails(projectId);

        if (base.status != ProjectRegistry.ProjectStatus.Active) revert InvalidProject();
        if (msg.sender != base.owner) revert NotProjectOwner();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientBalance();

        uint256 distributionId = distributionCount++;
        Distribution storage distribution = distributions[distributionId];
        distribution.id = distributionId;
        distribution.projectId = projectId;
        distribution.amount = balance;
        distribution.timestamp = block.timestamp;

        emit RevenueDistributed(distributionId, projectId, distribution.amount);
    }

    function approve(address claimer, bool approved) external {
        approvedClaimers[msg.sender][claimer] = approved;
        emit ClaimerApproved(msg.sender, claimer, approved);
    }

    function claimRevenue(uint256 distributionId) external whenNotPaused nonReentrant {
        Distribution storage distribution = distributions[distributionId];
        if (distribution.id != distributionId) revert InvalidDistribution();

        address investor = msg.sender;
        // If the caller is a contract, it must be approved by the investor
        if (msg.sender.code.length > 0) {
            investor = tx.origin;
            if (!approvedClaimers[investor][msg.sender]) {
                revert NotApproved();
            }
        }

        if (distribution.claimed[investor]) revert AlreadyClaimed();

        // Verify KYC status
        if (!projectRegistry.isKYCVerified(investor)) revert InvestorNotVerified();

        uint256 totalSupply = assetToken.totalSupply();
        if (totalSupply == 0) revert InvalidProject();

        uint256 investorBalance = assetToken.balanceOf(investor);
        if (investorBalance == 0) revert NoRevenue();

        uint256 share = (distribution.amount * investorBalance) / totalSupply;
        if (share == 0) revert NoRevenue();

        distribution.claimed[investor] = true;

        (bool success, ) = payable(investor).call{value: share}("");
        if (!success) revert TransferFailed();

        emit RevenueClaimed(distributionId, investor, share);
    }

    function claimRevenueFor(uint256 distributionId, address investor) external whenNotPaused nonReentrant {
        Distribution storage distribution = distributions[distributionId];
        if (distribution.id != distributionId) revert InvalidDistribution();
        if (!approvedClaimers[investor][msg.sender]) revert NotApproved();
        if (distribution.claimed[investor]) revert AlreadyClaimed();

        // Verify KYC status
        if (!projectRegistry.isKYCVerified(investor)) revert InvestorNotVerified();

        uint256 totalSupply = assetToken.totalSupply();
        if (totalSupply == 0) revert InvalidProject();

        uint256 investorBalance = assetToken.balanceOf(investor);
        if (investorBalance == 0) revert NoRevenue();

        uint256 share = (distribution.amount * investorBalance) / totalSupply;
        if (share == 0) revert NoRevenue();

        distribution.claimed[investor] = true;

        // Send ETH to the caller instead of the investor
        (bool success, ) = payable(msg.sender).call{value: share}("");
        if (!success) revert TransferFailed();

        emit RevenueClaimed(distributionId, investor, share);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    receive() external payable {
        // Accetta ETH
    }

    function getDistributionDetails(uint256 distributionId) external view returns (
        uint256 id,
        uint256 projectId,
        uint256 amount,
        uint256 timestamp
    ) {
        Distribution storage distribution = distributions[distributionId];
        return (
            distribution.id,
            distribution.projectId,
            distribution.amount,
            distribution.timestamp
        );
    }

    function hasClaimedRevenue(uint256 distributionId, address investor) external view returns (bool) {
        return distributions[distributionId].claimed[investor];
    }

    function calculateShare(uint256 distributionId, address investor) external view returns (uint256) {
        Distribution storage distribution = distributions[distributionId];
        if (distribution.id != distributionId) revert InvalidDistribution();

        uint256 totalSupply = assetToken.totalSupply();
        if (totalSupply == 0) return 0;

        uint256 investorBalance = assetToken.balanceOf(investor);
        return (distribution.amount * investorBalance) / totalSupply;
    }
}
