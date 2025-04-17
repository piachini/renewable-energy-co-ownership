# ProjectRegistry

## Overview
The ProjectRegistry contract manages the registration and lifecycle of energy projects. It handles project creation, status updates, and KYC verification for investors.

## Features
- Project registration and management
- Project lifecycle states
- KYC verification system
- Project status tracking
- Pausable operations

## Contract Details
- License: MIT
- Solidity Version: ^0.8.0
- Inherits From:
  - `Ownable`
  - `Pausable`

## Data Structures

### Project
```solidity
struct Project {
    uint256 id;
    string name;
    uint256 capacity;
    string location;
    uint256 totalInvestment;
    uint256 currentInvestment;
    ProjectStatus status;
    address owner;
    uint256 createdAt;
}
```

### ProjectStatus
```solidity
enum ProjectStatus {
    Pending,
    Active,
    Completed,
    Cancelled
}
```

## State Variables
- `mapping(uint256 => Project) public projects`: Project registry
- `mapping(address => bool) public kycVerified`: KYC verification status
- `uint256 public projectCount`: Total number of projects

## Events
- `ProjectRegistered(uint256 indexed projectId, string name, address owner)`
- `ProjectStatusUpdated(uint256 indexed projectId, ProjectStatus status)`
- `KYCVerified(address indexed investor)`

## Custom Errors
- `ProjectDoesNotExist()`: Project ID not found
- `InvalidStatus()`: Invalid project status
- `ProjectCompleted()`: Project already completed
- `InvalidAddress()`: Invalid address provided
- `AlreadyVerified()`: Address already KYC verified
- `EmptyName()`: Empty project name
- `EmptyLocation()`: Empty project location
- `ZeroCapacity()`: Zero project capacity

## Functions

### Administrative Functions

#### pause
```solidity
function pause() public onlyOwner
```
Pauses all contract operations.

#### unpause
```solidity
function unpause() public onlyOwner
```
Unpauses contract operations.

#### verifyKYC
```solidity
function verifyKYC(address investor) external onlyOwner
```
Verifies KYC status for an investor.

### Project Management

#### registerProject
```solidity
function registerProject(
    string memory name,
    uint256 capacity,
    string memory location
) external whenNotPaused
```
Registers a new energy project.

#### updateProjectStatus
```solidity
function updateProjectStatus(uint256 projectId, uint256 newStatus) external
```
Updates the status of a project.

### View Functions

#### getProjectDetails
```solidity
function getProjectDetails(uint256 projectId) external view returns (
    uint256 id,
    string memory name,
    uint256 capacity,
    string memory location,
    uint256 totalInvestment,
    uint256 currentInvestment,
    ProjectStatus status,
    address owner,
    uint256 createdAt
)
```
Returns detailed information about a project.

#### isKYCVerified
```solidity
function isKYCVerified(address investor) external view returns (bool)
```
Checks if an address is KYC verified.

## Security Considerations

### 1. Access Control
- Only owner can pause/unpause and verify KYC
- Only project owner can update project status
- Pausable for emergency situations

### 2. Input Validation
- Project name and location validation
- Capacity validation
- Status transition validation
- Address validation

### 3. State Management
- Clear project lifecycle states
- Protected status transitions
- Event emission for state changes

### 4. Gas Optimization
- Efficient project storage
- Minimal storage updates
- Optimized view functions

## Integration Guide

### Contract Setup
1. Deploy contract
2. Configure permissions
3. Set up KYC verification process

### Registering a Project
```javascript
await projectRegistry.registerProject(
    "Solar Farm Alpha",
    ethers.parseEther("1000"),
    "Texas, USA"
);
```

### Updating Project Status
```javascript
await projectRegistry.updateProjectStatus(projectId, 1); // Set to Active
```

### Verifying KYC
```javascript
await projectRegistry.verifyKYC(investorAddress);
```

## Testing Guide
1. **Unit Tests**
   ```bash
   npx hardhat test test/ProjectRegistry.test.js
   ```

2. **Integration Tests**
   ```bash
   npx hardhat test test/ContractIntegration.test.js
   ```

## Gas Usage
| Function | Gas Cost (approx.) |
|----------|-------------------|
| registerProject | 200,000 |
| updateProjectStatus | 50,000 |
| verifyKYC | 30,000 |
| getProjectDetails | 20,000 |
| isKYCVerified | 5,000 |

## Known Issues and Limitations
1. Project name and location are stored as strings
2. Limited to 4 project statuses
3. No project deletion functionality
4. KYC verification is binary (yes/no)

## Upgrade Path
1. Future upgrades may include:
   - Enhanced project metadata
   - Project categories
   - Multi-level KYC verification
   - Project archiving
   - Gas optimization improvements 