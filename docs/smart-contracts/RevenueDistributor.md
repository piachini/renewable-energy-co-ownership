# RevenueDistributor

## Overview
The RevenueDistributor contract manages the distribution of revenue from energy assets to token holders. It handles fee calculation, automated distribution, and distribution tracking.

## Features
- Revenue reception and distribution
- Fee management
- Distribution tracking
- Minimum distribution thresholds
- Automated processing

## Contract Details
- License: MIT
- Solidity Version: ^0.8.0
- Inherits From:
  - `Ownable`
  - `Pausable`
  - `ReentrancyGuard`

## Data Structures

### Distribution
```solidity
struct Distribution {
    uint256 projectId;
    uint256 amount;
    uint256 timestamp;
    uint256 totalTokens;
    uint256 feeAmount;
    bool processed;
}
```

### ProjectFees
```solidity
struct ProjectFees {
    uint256 distributionFee; // Fee percentage (basis points: 100 = 1%)
    address feeRecipient;
}
```

## State Variables
- `AssetToken public assetToken`: Token contract reference
- `ProjectRegistry public projectRegistry`: Project registry reference
- `mapping(uint256 => Distribution[]) public distributions`: Project distributions
- `mapping(uint256 => ProjectFees) public projectFees`: Project fee configurations
- `mapping(uint256 => uint256) public lastProcessedIndex`: Last processed distribution index
- `mapping(uint256 => uint256) public minDistributionAmount`: Minimum distribution thresholds

## Events
- `RevenueReceived(uint256 indexed projectId, uint256 amount)`
- `RevenueDistributed(uint256 indexed projectId, uint256 distributionId, uint256 amount, uint256 feeAmount)`
- `FeesUpdated(uint256 indexed projectId, uint256 distributionFee, address feeRecipient)`
- `MinDistributionAmountUpdated(uint256 indexed projectId, uint256 amount)`

## Custom Errors
- `InvalidProject()`
- `InvalidFeePercentage()`
- `InvalidFeeRecipient()`
- `InvalidAmount()`
- `NoRevenueToDistribute()`
- `DistributionAlreadyProcessed()`
- `InsufficientBalance()`
- `NotProjectOwner()`

## Functions

### Constructor
```solidity
constructor(address _assetToken, address _projectRegistry)
```
Initializes the contract with token and registry addresses.

### Administrative Functions

#### setProjectFees
```solidity
function setProjectFees(
    uint256 projectId,
    uint256 distributionFee,
    address feeRecipient
) external onlyOwner
```
Sets fee configuration for a project.

#### setMinDistributionAmount
```solidity
function setMinDistributionAmount(
    uint256 projectId,
    uint256 amount
) external onlyOwner
```
Sets minimum distribution amount for a project.

### Core Functions

#### receiveRevenue
```solidity
function receiveRevenue(uint256 projectId) external payable whenNotPaused
```
Receives revenue for a project and creates a distribution record.

#### processDistributions
```solidity
function processDistributions(
    uint256 projectId,
    uint256 maxDistributions
) external whenNotPaused nonReentrant
```
Processes pending distributions for a project.

### View Functions

#### getPendingDistributionsCount
```solidity
function getPendingDistributionsCount(
    uint256 projectId
) external view returns (uint256)
```
Returns the number of pending distributions for a project.

#### getDistribution
```solidity
function getDistribution(
    uint256 projectId,
    uint256 distributionId
) external view returns (Distribution memory)
```
Returns details of a specific distribution.

## Security Considerations
1. **Access Control**
   - Only project owners can submit revenue
   - Only contract owner can set fees and minimum amounts
   - Pausable for emergency situations

2. **Reentrancy Protection**
   - ReentrancyGuard for distribution processing
   - State changes before external calls

3. **Input Validation**
   - Project existence checks
   - Fee percentage limits
   - Amount validation

4. **Gas Optimization**
   - Batch processing of distributions
   - Efficient storage usage
   - Optimized loops

## Integration Guide

### Contract Setup
1. Deploy contract with token and registry addresses
2. Set project fees and minimum distribution amounts
3. Configure permissions

### Receiving Revenue
```javascript
await revenueDistributor.receiveRevenue(projectId, {
    value: ethers.parseEther("1.0")
});
```

### Processing Distributions
```javascript
await revenueDistributor.processDistributions(projectId, 5);
```

## Testing Guide
1. **Unit Tests**
   ```bash
   npx hardhat test test/RevenueDistributor.test.js
   ```

2. **Integration Tests**
   ```bash
   npx hardhat test test/ContractIntegration.test.js
   ```

## Gas Usage
| Function | Gas Cost (approx.) |
|----------|-------------------|
| receiveRevenue | 150,000 |
| processDistributions | 200,000 per distribution |
| setProjectFees | 50,000 |
| setMinDistributionAmount | 45,000 |

## Known Issues and Limitations
1. Maximum of 100 distributions can be processed in a single transaction
2. Fee percentage limited to 10%
3. Requires manual processing of distributions

## Upgrade Path
1. Future upgrades may include:
   - Automated distribution triggers
   - Dynamic fee structures
   - Multi-token support
   - Gas optimization improvements 