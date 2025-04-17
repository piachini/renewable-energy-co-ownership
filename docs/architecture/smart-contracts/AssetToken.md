# AssetToken Contract Documentation

## Overview
The AssetToken contract is an ERC-20 token implementation that represents ownership of energy assets. It includes functionality for minting, burning, and dividend distribution.

## Contract Details
- **Name**: AssetToken
- **Version**: 1.0.0
- **License**: MIT
- **Inherits**: ERC20, Ownable, Pausable

## Features
1. **Token Management**
   - Minting new tokens
   - Burning existing tokens
   - Transfer functionality
   - Pausable operations

2. **Dividend Distribution**
   - Automatic dividend calculation
   - Dividend claiming
   - Per-token dividend tracking
   - Transfer-aware dividend handling

## Functions

### Constructor
```solidity
constructor(string memory name_, string memory symbol_)
```
- Initializes the token with name and symbol
- Sets the deployer as the owner

### Minting
```solidity
function mint(address to, uint256 amount) external onlyOwner whenNotPaused
```
- Mints new tokens to specified address
- Only callable by owner
- Requires contract not to be paused
- Emits `TokensMinted` event

### Burning
```solidity
function burn(address from, uint256 amount) external onlyOwner whenNotPaused
```
- Burns tokens from specified address
- Only callable by owner
- Requires contract not to be paused
- Emits `TokensBurned` event

### Dividend Distribution
```solidity
function distributeDividends(uint256 amount) external payable whenNotPaused
```
- Distributes dividends to all token holders
- Dividends are distributed proportionally to token holdings
- Requires exact payment amount
- Emits `DividendsDistributed` event

### Dividend Claiming
```solidity
function claimDividends() external whenNotPaused
```
- Claims available dividends for the caller
- Transfers dividends to caller's address
- Emits `DividendsClaimed` event

### View Functions
```solidity
function getClaimableDividends(address account) public view returns (uint256)
```
- Returns amount of claimable dividends for an address

```solidity
function getTotalDividends() external view returns (uint256)
```
- Returns total amount of distributed dividends

### Pausing
```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
```
- Pauses/unpauses all token operations
- Only callable by owner

## Events
- `TokensMinted(address indexed to, uint256 amount)`
- `TokensBurned(address indexed from, uint256 amount)`
- `DividendsDistributed(uint256 amount)`
- `DividendsClaimed(address indexed account, uint256 amount)`

## Security Considerations
1. **Access Control**
   - Only owner can mint/burn tokens
   - Only owner can pause/unpause contract
   - Dividend distribution open to all

2. **Input Validation**
   - Non-zero address checks
   - Positive amount checks
   - Sufficient balance checks

3. **Pausable**
   - Emergency stop functionality
   - Prevents all token operations when paused

## Usage Examples

### Minting Tokens
```solidity
// Mint 1000 tokens to address
await assetToken.mint(userAddress, 1000);
```

### Distributing Dividends
```solidity
// Distribute 1 ETH in dividends
await assetToken.distributeDividends(ethers.utils.parseEther("1"), {
  value: ethers.utils.parseEther("1")
});
```

### Claiming Dividends
```solidity
// Claim available dividends
await assetToken.claimDividends();
```

## Testing
The contract includes comprehensive tests covering:
- Deployment
- Minting
- Burning
- Dividend distribution
- Dividend claiming
- Pausing functionality

## Gas Optimization
1. **Storage Optimization**
   - Uses mappings for efficient dividend tracking
   - Implements per-token dividend calculation

2. **Operation Optimization**
   - Batch dividend distribution
   - Efficient transfer handling

## Audit Considerations
1. **Security**
   - OpenZeppelin contracts inheritance
   - Access control implementation
   - Input validation

2. **Functionality**
   - ERC-20 compliance
   - Dividend distribution accuracy
   - Transfer handling

## Deployment
1. **Requirements**
   - Solidity ^0.8.0
   - OpenZeppelin contracts
   - Hardhat/Foundry for testing

2. **Steps**
   - Compile contract
   - Run tests
   - Deploy to network
   - Verify on Etherscan 