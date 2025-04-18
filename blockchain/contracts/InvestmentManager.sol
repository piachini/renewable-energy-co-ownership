// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AssetToken.sol";
import "./ProjectRegistry.sol";

contract InvestmentManager is Ownable, Pausable, ReentrancyGuard {
    struct Investment {
        uint256 projectId;
        address investor;
        uint256 amount;
        uint256 tokens;
        uint256 timestamp;
    }

    AssetToken public assetToken;
    ProjectRegistry public projectRegistry;
    mapping(uint256 => Investment[]) public projectInvestments;
    mapping(address => mapping(uint256 => uint256)) public investorProjectBalance;
    mapping(address => mapping(uint256 => uint256)) public totalInvested;

    event InvestmentMade(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount,
        uint256 tokens
    );
    event InvestmentWithdrawn(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );

    error ProjectNotFound();
    error ProjectNotActive();
    error InvestorNotVerified();
    error InvalidAmount();
    error AmountBelowMinimum();
    error AmountAboveMaximum();
    error InsufficientBalance();

    constructor(address _assetToken, address _projectRegistry) {
        assetToken = AssetToken(payable(_assetToken));
        projectRegistry = ProjectRegistry(_projectRegistry);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function makeInvestment(uint256 projectId) external payable whenNotPaused nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        if (!projectRegistry.isKYCVerified(msg.sender)) revert InvestorNotVerified();

        // Verify project exists and is active
        (
            ProjectRegistry.ProjectBase memory base,
            ProjectRegistry.ProjectFinancials memory financials,
            ProjectRegistry.ProjectTechnical memory technical
        ) = projectRegistry.getProjectDetails(projectId);
        
        if (base.owner == address(0)) revert ProjectNotFound();
        if (base.status != ProjectRegistry.ProjectStatus.Active) revert ProjectNotActive();
        
        // Validate investment amount
        if (msg.value < financials.minInvestment) revert AmountBelowMinimum();
        if (msg.value > financials.maxInvestment) revert AmountAboveMaximum();

        // Calculate tokens
        uint256 tokens = calculateTokens(msg.value);
        
        // Record investment
        projectInvestments[projectId].push(Investment({
            projectId: projectId,
            investor: msg.sender,
            amount: msg.value,
            tokens: tokens,
            timestamp: block.timestamp
        }));
        
        // Update balances
        investorProjectBalance[msg.sender][projectId] += tokens;
        totalInvested[msg.sender][projectId] += msg.value;
        
        // Mint tokens
        assetToken.mint(msg.sender, tokens);
        
        emit InvestmentMade(projectId, msg.sender, msg.value, tokens);
    }

    function withdrawInvestment(uint256 projectId, uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        // Verify project exists
        (
            ProjectRegistry.ProjectBase memory base,
            ,  // financials
            ProjectRegistry.ProjectTechnical memory technical
        ) = projectRegistry.getProjectDetails(projectId);
        
        if (base.owner == address(0)) revert ProjectNotFound();
        if (investorProjectBalance[msg.sender][projectId] < amount) revert InsufficientBalance();

        // Update balances
        investorProjectBalance[msg.sender][projectId] -= amount;
        totalInvested[msg.sender][projectId] -= amount;

        // Burn tokens
        assetToken.burn(msg.sender, amount);

        emit InvestmentWithdrawn(projectId, msg.sender, amount);
    }

    function getInvestmentDetails(uint256 projectId, address investor)
        external
        view
        returns (
            uint256 totalInvestedAmount,
            uint256 tokenBalance,
            uint256 lastInvestmentTime
        )
    {
        Investment[] memory investments = projectInvestments[projectId];
        uint256 lastTime = 0;

        for (uint256 i = 0; i < investments.length; i++) {
            if (investments[i].investor == investor && investments[i].timestamp > lastTime) {
                lastTime = investments[i].timestamp;
            }
        }

        return (
            totalInvested[investor][projectId],
            investorProjectBalance[investor][projectId],
            lastTime
        );
    }

    function calculateTokens(uint256 amount)
        internal
        pure
        returns (uint256)
    {
        // Simple 1:1 ratio for now, can be modified based on project valuation
        return amount;
    }
}
