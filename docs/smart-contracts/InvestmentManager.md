# InvestmentManager

## Overview
The InvestmentManager contract handles investment operations for energy projects. It manages investment opportunities, fundraising, token distribution, and investment limits.

## Features
- Investment opportunity management
- Fundraising logic
- Token distribution
- Investment limit management
- KYC verification integration

## Contract Details
- License: MIT
- Solidity Version: ^0.8.0
- Inherits From:
  - `Ownable`
  - `Pausable`
  - `ReentrancyGuard`

## Data Structures

### Investment
```solidity
struct Investment {
    uint256 projectId;
    address investor;
    uint256 amount;
    uint256 tokens;
    uint256 timestamp;
    bool active;
}
```

## State Variables
- `ProjectRegistry public projectRegistry`: Project registry reference
- `AssetToken public assetToken`: Token contract reference
- `mapping(uint256 => Investment[]) public investments`: Project investments
- `mapping(uint256 => uint256) public totalInvestments`: Total investments per project
- `mapping(uint256 => uint256) public minInvestment`: Minimum investment per project
- `mapping(uint256 => uint256) public maxInvestment`: Maximum investment per project

## Events
- `InvestmentMade(uint256 indexed projectId, address indexed investor, uint256 amount, uint256 tokens)`
- `InvestmentWithdrawn(uint256 indexed projectId, address indexed investor, uint256 amount)`
- `InvestmentLimitsUpdated(uint256 indexed projectId, uint256 minAmount, uint256 maxAmount)`

## Custom Errors
- `InvalidProject()`: Project does not exist
- `InvalidAmount()`: Invalid investment amount
- `InvestmentLimitExceeded()`: Investment exceeds limits
- `InsufficientFunds()`: Insufficient funds for investment
- `NotKYCVerified()`: Investor not KYC verified
- `InvestmentNotFound()`: Investment not found
- `InvestmentNotActive()`: Investment is not active

## Functions

### Constructor
```solidity
constructor(address _projectRegistry, address _assetToken)
```
Initializes the contract with registry and token addresses.

### Administrative Functions

#### setInvestmentLimits
```solidity
function setInvestmentLimits(
    uint256 projectId,
    uint256 minAmount,
    uint256 maxAmount
) external onlyOwner
```
Sets investment limits for a project.

#### pause
```solidity
function pause() public onlyOwner
```
Pauses all investment operations.

#### unpause
```solidity
function unpause() public onlyOwner
```
Unpauses investment operations.

### Investment Operations

#### invest
```solidity
function invest(uint256 projectId) external payable whenNotPaused nonReentrant
```
Makes an investment in a project.

#### withdrawInvestment
```solidity
function withdrawInvestment(uint256 projectId) external whenNotPaused nonReentrant
```
Withdraws an investment from a project.

### View Functions

#### getInvestment
```solidity
function getInvestment(
    uint256 projectId,
    address investor
) external view returns (Investment memory)
```
Returns investment details for an investor in a project.

#### getTotalInvestments
```solidity
function getTotalInvestments(uint256 projectId) external view returns (uint256)
```
Returns total investments for a project.

#### getInvestmentLimits
```solidity
function getInvestmentLimits(
    uint256 projectId
) external view returns (uint256 minAmount, uint256 maxAmount)
```
Returns investment limits for a project.

## Security Considerations

### 1. Access Control
- Only owner can set investment limits
- Only KYC verified investors can invest
- Pausable for emergency situations

### 2. Fund Management
- Reentrancy protection
- Safe fund transfers
- Investment limit enforcement
- Project status validation

### 3. Input Validation
- Project existence checks
- Investment amount validation
- KYC verification checks
- Investment status validation

### 4. Gas Optimization
- Efficient investment tracking
- Batch processing capabilities
- Minimal storage updates
- Optimized view functions

## Integration Guide

### Contract Setup
1. Deploy contract with registry and token addresses
2. Set investment limits for projects
3. Configure permissions

### Making an Investment
```javascript
await investmentManager.invest(projectId, {
    value: ethers.parseEther("1.0")
});
```

### Withdrawing Investment
```javascript
await investmentManager.withdrawInvestment(projectId);
```

### Checking Investment Limits
```javascript
const [minAmount, maxAmount] = await investmentManager.getInvestmentLimits(projectId);
```

## Testing Guide
1. **Unit Tests**
   ```bash
   npx hardhat test test/InvestmentManager.test.js
   ```

2. **Integration Tests**
   ```bash
   npx hardhat test test/ContractIntegration.test.js
   ```

## Gas Usage
| Function | Gas Cost (approx.) |
|----------|-------------------|
| invest | 250,000 |
| withdrawInvestment | 150,000 |
| setInvestmentLimits | 50,000 |
| getInvestment | 20,000 |
| getTotalInvestments | 5,000 |

## Known Issues and Limitations
1. Investment amounts are fixed in ETH
2. No partial withdrawal support
3. Limited to one active investment per project per investor
4. No investment period restrictions

## Upgrade Path
1. Future upgrades may include:
   - Multi-token investment support
   - Partial withdrawal functionality
   - Investment period management
   - Enhanced investment tracking
   - Gas optimization improvements 