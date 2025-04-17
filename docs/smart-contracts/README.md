# Smart Contracts Documentation

## Overview
This documentation covers the core smart contracts of the Renewable Energy Co-Ownership Platform. The platform enables tokenization of renewable energy assets and manages investments, revenue distribution, and project lifecycle.

## Core Contracts

### [AssetToken](./AssetToken.md)
ERC-20 token representing ownership shares in energy assets. Handles dividend distribution and token management.

### [ProjectRegistry](./ProjectRegistry.md)
Manages the registration and lifecycle of energy projects, including KYC verification and project status updates.

### [InvestmentManager](./InvestmentManager.md)
Handles investment operations, token minting, and investment limits for energy projects.

### [RevenueDistributor](./RevenueDistributor.md)
Manages revenue distribution to token holders, including fee calculation and automated distribution.

## Contract Interactions
![Contract Interactions](./diagrams/contract-interactions.svg)

## Security Features
- OpenZeppelin's secure contract implementations
- Role-based access control
- Pausable functionality
- Reentrancy protection
- KYC verification

## Gas Optimization
- Efficient data structures
- Batch processing capabilities
- Strategic use of storage vs memory
- Optimized loops and calculations

## Deployment Process
1. Deploy ProjectRegistry
2. Deploy AssetToken
3. Deploy InvestmentManager
4. Deploy RevenueDistributor
5. Configure contract permissions
6. Verify contracts on block explorer

## Testing
- Comprehensive unit tests
- Integration tests
- Security tests
- Gas optimization tests

## Auditing
- Internal code review
- External audit preparation
- Known issues and mitigations
- Security best practices

## Contract Addresses
### Testnet (Sepolia)
- ProjectRegistry: `[TBD]`
- AssetToken: `[TBD]`
- InvestmentManager: `[TBD]`
- RevenueDistributor: `[TBD]`

### Mainnet
- ProjectRegistry: `[TBD]`
- AssetToken: `[TBD]`
- InvestmentManager: `[TBD]`
- RevenueDistributor: `[TBD]` 