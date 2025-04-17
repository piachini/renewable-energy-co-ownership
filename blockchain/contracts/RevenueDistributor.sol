// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./AssetToken.sol";
import "./ProjectRegistry.sol";

/**
 * @title RevenueDistributor
 * @dev Manages revenue distribution for energy asset projects
 * @notice This contract handles the calculation and distribution of revenue to token holders
 */
contract RevenueDistributor is Ownable, Pausable, ReentrancyGuard {
    struct Distribution {
        uint256 projectId;
        uint256 amount;
        uint256 timestamp;
        uint256 totalTokens;
        uint256 feeAmount;
        bool processed;
    }

    struct ProjectFees {
        uint256 distributionFee; // Fee percentage (basis points: 100 = 1%)
        address feeRecipient;
    }

    AssetToken public assetToken;
    ProjectRegistry public projectRegistry;
    
    // Project ID => Distribution[]
    mapping(uint256 => Distribution[]) public distributions;
    // Project ID => ProjectFees
    mapping(uint256 => ProjectFees) public projectFees;
    // Project ID => Last processed distribution index
    mapping(uint256 => uint256) public lastProcessedIndex;
    // Project ID => Minimum distribution amount
    mapping(uint256 => uint256) public minDistributionAmount;

    event RevenueReceived(uint256 indexed projectId, uint256 amount);
    event RevenueDistributed(uint256 indexed projectId, uint256 distributionId, uint256 amount, uint256 feeAmount);
    event FeesUpdated(uint256 indexed projectId, uint256 distributionFee, address feeRecipient);
    event MinDistributionAmountUpdated(uint256 indexed projectId, uint256 amount);

    error InvalidProject();
    error InvalidFeePercentage();
    error InvalidFeeRecipient();
    error InvalidAmount();
    error NoRevenueToDistribute();
    error DistributionAlreadyProcessed();
    error InsufficientBalance();
    error NotProjectOwner();

    constructor(address _assetToken, address _projectRegistry) {
        assetToken = AssetToken(payable(_assetToken));
        projectRegistry = ProjectRegistry(_projectRegistry);
    }

    /**
     * @dev Pauses the contract
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpauses the contract
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Sets the fee configuration for a project
     * @param projectId The ID of the project
     * @param distributionFee The fee percentage in basis points (100 = 1%)
     * @param feeRecipient The address to receive the fees
     */
    function setProjectFees(
        uint256 projectId,
        uint256 distributionFee,
        address feeRecipient
    ) external onlyOwner {
        if (!_projectExists(projectId)) revert InvalidProject();
        if (distributionFee > 1000) revert InvalidFeePercentage(); // Max 10%
        if (feeRecipient == address(0)) revert InvalidFeeRecipient();

        projectFees[projectId] = ProjectFees({
            distributionFee: distributionFee,
            feeRecipient: feeRecipient
        });

        emit FeesUpdated(projectId, distributionFee, feeRecipient);
    }

    /**
     * @dev Sets the minimum amount required for a distribution
     * @param projectId The ID of the project
     * @param amount The minimum amount
     */
    function setMinDistributionAmount(uint256 projectId, uint256 amount) external onlyOwner {
        if (!_projectExists(projectId)) revert InvalidProject();
        minDistributionAmount[projectId] = amount;
        emit MinDistributionAmountUpdated(projectId, amount);
    }

    /**
     * @dev Receives revenue for a project
     * @param projectId The ID of the project
     */
    function receiveRevenue(uint256 projectId) external payable whenNotPaused {
        if (!_projectExists(projectId)) revert InvalidProject();
        if (msg.value == 0) revert InvalidAmount();

        // Get project details and check ownership
        (,,,,,, , address owner,) = projectRegistry.getProjectDetails(projectId);
        if (msg.sender != owner) revert NotProjectOwner();

        uint256 totalTokens = assetToken.totalSupply();
        if (totalTokens == 0) revert NoRevenueToDistribute();

        distributions[projectId].push(Distribution({
            projectId: projectId,
            amount: msg.value,
            timestamp: block.timestamp,
            totalTokens: totalTokens,
            feeAmount: _calculateFee(projectId, msg.value),
            processed: false
        }));

        emit RevenueReceived(projectId, msg.value);
    }

    /**
     * @dev Processes pending distributions for a project
     * @param projectId The ID of the project
     * @param maxDistributions Maximum number of distributions to process
     */
    function processDistributions(uint256 projectId, uint256 maxDistributions) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        if (!_projectExists(projectId)) revert InvalidProject();
        
        uint256 currentIndex = lastProcessedIndex[projectId];
        uint256 distributionsLength = distributions[projectId].length;
        uint256 processedCount = 0;

        while (
            currentIndex < distributionsLength && 
            processedCount < maxDistributions &&
            address(this).balance >= distributions[projectId][currentIndex].amount
        ) {
            Distribution storage dist = distributions[projectId][currentIndex];
            
            if (dist.processed) {
                currentIndex++;
                continue;
            }

            if (dist.amount < minDistributionAmount[projectId]) {
                currentIndex++;
                continue;
            }

            // Process fees
            if (dist.feeAmount > 0 && projectFees[projectId].feeRecipient != address(0)) {
                (bool feeSuccess, ) = projectFees[projectId].feeRecipient.call{value: dist.feeAmount}("");
                require(feeSuccess, "Fee transfer failed");
            }

            // Calculate amount per token
            uint256 distributionAmount = dist.amount - dist.feeAmount;

            // Distribute revenue through the AssetToken contract
            assetToken.distributeDividends{value: distributionAmount}();

            dist.processed = true;
            emit RevenueDistributed(projectId, currentIndex, distributionAmount, dist.feeAmount);

            currentIndex++;
            processedCount++;
        }

        lastProcessedIndex[projectId] = currentIndex;
    }

    /**
     * @dev Gets the number of pending distributions for a project
     * @param projectId The ID of the project
     * @return count The number of pending distributions
     */
    function getPendingDistributionsCount(uint256 projectId) external view returns (uint256) {
        if (!_projectExists(projectId)) revert InvalidProject();
        
        uint256 count = 0;
        uint256 currentIndex = lastProcessedIndex[projectId];
        
        while (currentIndex < distributions[projectId].length) {
            if (!distributions[projectId][currentIndex].processed) {
                count++;
            }
            currentIndex++;
        }
        
        return count;
    }

    /**
     * @dev Gets distribution details
     * @param projectId The ID of the project
     * @param distributionId The ID of the distribution
     * @return Distribution details
     */
    function getDistribution(uint256 projectId, uint256 distributionId) 
        external 
        view 
        returns (Distribution memory) 
    {
        if (!_projectExists(projectId)) revert InvalidProject();
        if (distributionId >= distributions[projectId].length) revert InvalidAmount();
        
        return distributions[projectId][distributionId];
    }

    /**
     * @dev Calculates the fee amount for a distribution
     * @param projectId The ID of the project
     * @param amount The distribution amount
     * @return The fee amount
     */
    function _calculateFee(uint256 projectId, uint256 amount) internal view returns (uint256) {
        return amount * projectFees[projectId].distributionFee / 10000;
    }

    /**
     * @dev Checks if a project exists
     * @param projectId The ID of the project
     * @return bool Whether the project exists
     */
    function _projectExists(uint256 projectId) internal view returns (bool) {
        try projectRegistry.getProjectDetails(projectId) returns (
            uint256,
            string memory,
            uint256,
            string memory,
            uint256,
            uint256,
            ProjectRegistry.ProjectStatus /* status */,
            address owner,
            uint256
        ) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {
        // Allow receiving ETH
    }
}
