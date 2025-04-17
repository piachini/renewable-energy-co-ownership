// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./AssetToken.sol";
import "./ProjectRegistry.sol";

contract InvestmentManager is Ownable, Pausable {
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

    function invest(uint256 projectId, uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(
            projectRegistry.isKYCVerified(msg.sender),
            "Investor not KYC verified"
        );

        // Verifica che il progetto esista e sia attivo
        (
            ,  // id
            ,  // name
            ,  // capacity
            ,  // location
            ,  // totalInvestment
            ,  // currentInvestment
            ProjectRegistry.ProjectStatus status,
            address owner,
            // createdAt
        ) = projectRegistry.getProjectDetails(projectId);
        
        require(owner != address(0), "Project does not exist");
        require(status == ProjectRegistry.ProjectStatus.Active, "Project is not active");

        // Calculate tokens based on investment amount
        uint256 tokens = calculateTokens(amount);

        // Record investment
        projectInvestments[projectId].push(
            Investment({
                projectId: projectId,
                investor: msg.sender,
                amount: amount,
                tokens: tokens,
                timestamp: block.timestamp
            })
        );

        // Update investor balance
        investorProjectBalance[msg.sender][projectId] += tokens;

        // Mint tokens to investor
        assetToken.mint(msg.sender, tokens);

        emit InvestmentMade(projectId, msg.sender, amount, tokens);
    }

    function withdrawInvestment(uint256 projectId, uint256 amount) external whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        // Verifica che il progetto esista
        (
            ,  // id
            ,  // name
            ,  // capacity
            ,  // location
            ,  // totalInvestment
            ,  // currentInvestment
            ,  // status
            address owner,
            // createdAt
        ) = projectRegistry.getProjectDetails(projectId);
        
        require(owner != address(0), "Project does not exist");
        require(
            investorProjectBalance[msg.sender][projectId] >= amount,
            "Insufficient balance"
        );

        // Burn tokens
        assetToken.burn(msg.sender, amount);

        // Update investor balance
        investorProjectBalance[msg.sender][projectId] -= amount;

        emit InvestmentWithdrawn(projectId, msg.sender, amount);
    }

    function getInvestmentDetails(uint256 projectId, address investor)
        external
        view
        returns (
            uint256 totalInvested,
            uint256 tokenBalance,
            uint256 lastInvestmentTime
        )
    {
        Investment[] memory investments = projectInvestments[projectId];
        uint256 total = 0;
        uint256 lastTime = 0;

        for (uint256 i = 0; i < investments.length; i++) {
            if (investments[i].investor == investor) {
                total += investments[i].amount;
                if (investments[i].timestamp > lastTime) {
                    lastTime = investments[i].timestamp;
                }
            }
        }

        return (
            total,
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

    function makeInvestment(uint256 projectId) external payable whenNotPaused {
        require(msg.value > 0, "Investment amount must be greater than 0");
        
        // Verifica che il progetto esista e sia attivo
        (
            ,  // id
            ,  // name
            ,  // capacity
            ,  // location
            ,  // totalInvestment
            ,  // currentInvestment
            ProjectRegistry.ProjectStatus status,
            address owner,
            // createdAt
        ) = projectRegistry.getProjectDetails(projectId);
        
        require(owner != address(0), "Project does not exist");
        require(status == ProjectRegistry.ProjectStatus.Active, "Project is not active");
        
        // Verifica che l'investitore sia verificato KYC
        require(projectRegistry.isKYCVerified(msg.sender), "Investor not KYC verified");
        
        // Calcola i token da emettere
        uint256 tokens = calculateTokens(msg.value);
        
        // Aggiorna gli investimenti
        projectInvestments[projectId].push(Investment({
            projectId: projectId,
            investor: msg.sender,
            amount: msg.value,
            tokens: tokens,
            timestamp: block.timestamp
        }));
        
        investorProjectBalance[msg.sender][projectId] += msg.value;
        
        // Emetti i token
        assetToken.mint(msg.sender, tokens);
        
        emit InvestmentMade(projectId, msg.sender, msg.value, tokens);
    }
}
