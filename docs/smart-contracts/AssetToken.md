# AssetToken

## Overview
The AssetToken contract is an ERC-20 token implementation that represents ownership shares in energy assets. It handles token minting, burning, and dividend distribution to token holders.

## Features
- ERC-20 compliant token
- Dividend distribution system
- Minting and burning functionality
- Pausable operations
- Dividend tracking per holder

## Contract Details
- License: MIT
- Solidity Version: ^0.8.20
- Inherits From:
  - `ERC20`
  - `Ownable`
  - `Pausable`

## State Variables
- `address private _minter`: Address authorized to mint/burn tokens
- `uint256 private _totalDividends`: Total dividends distributed
- `mapping(address => uint256) private _dividendCredits`: Unclaimed dividends per holder
- `mapping(address => uint256) private _lastClaimedDividends`: Last claimed dividend index
- `address[] private _holders`: List of token holders
- `mapping(address => bool) private _isHolder`: Holder existence check
- `uint256 private constant PRECISION`: Precision for dividend calculations (1e18)

## Events
- `DividendsDistributed(uint256 amount)`: Emitted when dividends are distributed
- `DividendsClaimed(address indexed holder, uint256 amount)`: Emitted when dividends are claimed

## Custom Errors
- `OnlyMinter()`: Unauthorized minting/burning attempt
- `NoDividendsToClaim()`: No dividends available to claim
- `InsufficientBalance()`: Insufficient token balance for operation

## Functions

### Constructor
```solidity
constructor(string memory name, string memory symbol)
```
Initializes the token with name and symbol, sets the deployer as owner.

### Administrative Functions

#### setMinter
```solidity
function setMinter(address minterAddress) public onlyOwner
```
Sets the address authorized to mint and burn tokens.

#### pause
```solidity
function pause() public onlyOwner
```
Pauses all token operations.

#### unpause
```solidity
function unpause() public onlyOwner
```
Unpauses token operations.

### Token Operations

#### mint
```solidity
function mint(address to, uint256 amount) public whenNotPaused
```
Mints new tokens to the specified address.

#### burn
```solidity
function burn(address from, uint256 amount) public whenNotPaused
```
Burns tokens from the specified address.

### Dividend Operations

#### distributeDividends
```solidity
function distributeDividends() public payable whenNotPaused
```
Distributes dividends to all token holders proportionally to their holdings.

#### claimDividends
```solidity
function claimDividends() public whenNotPaused
```
Allows token holders to claim their accumulated dividends.

### View Functions

#### minter
```solidity
function minter() public view returns (address)
```
Returns the current minter address.

#### getClaimableDividends
```solidity
function getClaimableDividends(address account) public view returns (uint256)
```
Returns the amount of claimable dividends for an account.

#### getTotalDividends
```solidity
function getTotalDividends() public view returns (uint256)
```
Returns the total amount of dividends distributed.

## Security Considerations

### 1. Access Control
- Only owner can set minter and pause/unpause
- Only minter can mint/burn tokens
- Pausable for emergency situations

### 2. Dividend Distribution
- Precise proportional distribution
- Protection against reentrancy
- Safe dividend claiming process

### 3. Token Transfers
- Pausable transfers
- Dividend credit transfer on token transfer
- Safe token operations

### 4. Gas Optimization
- Efficient holder tracking
- Optimized dividend calculations
- Minimal storage usage

## Integration Guide

### Contract Setup
1. Deploy contract with name and symbol
2. Set minter address
3. Configure permissions

### Minting Tokens
```javascript
await assetToken.mint(userAddress, amount);
```

### Distributing Dividends
```javascript
await assetToken.distributeDividends({ value: ethers.parseEther("1.0") });
```

### Claiming Dividends
```javascript
await assetToken.claimDividends();
```

## Testing Guide
1. **Unit Tests**
   ```bash
   npx hardhat test test/AssetToken.test.js
   ```

2. **Integration Tests**
   ```bash
   npx hardhat test test/ContractIntegration.test.js
   ```

## Gas Usage
| Function | Gas Cost (approx.) |
|----------|-------------------|
| mint | 100,000 |
| burn | 80,000 |
| distributeDividends | 150,000 |
| claimDividends | 70,000 |
| transfer | 60,000 |

## Known Issues and Limitations
1. Maximum precision for dividend calculations is 18 decimals
2. Dividend distribution requires ETH transfer
3. Gas costs increase with number of holders

## Upgrade Path
1. Future upgrades may include:
   - Multi-token dividend support
   - Automated dividend distribution
   - Enhanced holder tracking
   - Gas optimization improvements 