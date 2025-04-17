// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AssetToken.sol";
import "./InvestmentManager.sol";

contract RevenueDistributor is Ownable, Pausable {
    struct Distribution {
        uint256 projectId;
        uint256 amount;
        uint256 timestamp;
        bool completed;
    }

    AssetToken public assetToken;
    InvestmentManager public investmentManager;
    mapping(uint256 => Distribution[]) public projectDistributions;
    mapping(uint256 => mapping(address => bool)) public claimedDistributions;

    event RevenueReceived(uint256 indexed projectId, uint256 amount);
    event DistributionCompleted(uint256 indexed projectId, uint256 distributionId);
    event RevenueClaimed(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );

    constructor(address _assetToken, address _investmentManager) {
        assetToken = AssetToken(payable(_assetToken));
        investmentManager = InvestmentManager(_investmentManager);
    }

    function receiveRevenue(uint256 projectId, uint256 amount)
        external
        payable
        whenNotPaused
    {
        require(amount > 0, "Amount must be greater than 0");
        require(msg.value == amount, "Incorrect payment amount");

        // Record the distribution
        uint256 distributionId = projectDistributions[projectId].length;
        projectDistributions[projectId].push(
            Distribution({
                projectId: projectId,
                amount: amount,
                timestamp: block.timestamp,
                completed: false
            })
        );

        emit RevenueReceived(projectId, amount);
    }

    function distributeRevenue(uint256 projectId, uint256 distributionId)
        external
        onlyOwner
        whenNotPaused
    {
        require(
            distributionId < projectDistributions[projectId].length,
            "Invalid distribution ID"
        );
        Distribution storage distribution = projectDistributions[projectId][distributionId];
        require(!distribution.completed, "Distribution already completed");

        // Calculate total tokens for the project
        uint256 totalTokens = assetToken.totalSupply();
        require(totalTokens > 0, "No tokens in circulation");

        // Mark distribution as completed
        distribution.completed = true;

        emit DistributionCompleted(projectId, distributionId);
    }

    function claimRevenue(uint256 projectId, uint256 distributionId)
        external
        whenNotPaused
    {
        require(
            distributionId < projectDistributions[projectId].length,
            "Invalid distribution ID"
        );
        Distribution storage distribution = projectDistributions[projectId][distributionId];
        require(distribution.completed, "Distribution not completed");
        require(
            !claimedDistributions[projectId][msg.sender],
            "Already claimed"
        );

        // Get investor's token balance
        uint256 tokenBalance = assetToken.balanceOf(msg.sender);
        require(tokenBalance > 0, "No tokens to claim");

        // Calculate share based on token balance
        uint256 totalTokens = assetToken.totalSupply();
        uint256 share = (distribution.amount * tokenBalance) / totalTokens;

        // Mark as claimed
        claimedDistributions[projectId][msg.sender] = true;

        // Transfer share to investor
        payable(msg.sender).transfer(share);

        emit RevenueClaimed(projectId, msg.sender, share);
    }

    function getDistributionDetails(uint256 projectId, uint256 distributionId)
        external
        view
        returns (
            uint256 amount,
            uint256 timestamp,
            bool completed
        )
    {
        require(
            distributionId < projectDistributions[projectId].length,
            "Invalid distribution ID"
        );
        Distribution memory distribution = projectDistributions[projectId][distributionId];
        return (distribution.amount, distribution.timestamp, distribution.completed);
    }
}
