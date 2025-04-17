# Smart Contracts Documentation

## AssetToken.sol
ERC-20 contract for representing energy asset ownership.

### Main Features
- Token minting and burning
- Transfer management
- Dividend distribution
- Ownership verification

### Main Functions
```solidity
function mint(address to, uint256 amount) external onlyOwner
function burn(address from, uint256 amount) external onlyOwner
function distributeDividend(uint256 amount) external onlyOwner
function getBalance(address account) external view returns (uint256)
```

## ProjectRegistry.sol
Energy project registry and lifecycle management.

### Main Features
- Project registration
- Project status management
- Oracle integration
- KYC/AML verification

### Main Functions
```solidity
function registerProject(string memory name, uint256 capacity) external
function updateProjectStatus(uint256 projectId, ProjectStatus status) external
function verifyKYC(address investor) external
function getProjectDetails(uint256 projectId) external view returns (ProjectDetails memory)
```

## InvestmentManager.sol
Investment opportunity management and token distribution.

### Main Features
- Investment management
- Fundraising logic
- Token distribution
- Investment limits

### Main Functions
```solidity
function invest(uint256 projectId, uint256 amount) external
function withdrawInvestment(uint256 projectId, uint256 amount) external
function getInvestmentDetails(uint256 projectId, address investor) external view returns (InvestmentDetails memory)
```

## RevenueDistributor.sol
Revenue calculation and distribution.

### Main Features
- Revenue calculation
- Automatic distribution
- Distribution tracking
- Fee management

### Main Functions
```solidity
function calculateRevenue(uint256 projectId, uint256 period) external
function distributeRevenue(uint256 projectId) external
function claimRevenue(uint256 projectId) external
function getRevenueDetails(uint256 projectId) external view returns (RevenueDetails memory)
```

## Security
- OpenZeppelin implementation
- Overflow/underflow checks
- Authorization management
- Pause functions
- Gas limits

## Testing
- Unit tests for each contract
- Integration tests
- Stress tests
- Network simulations

## Deployment
- Multi-signature process
- Code verification on Etherscan
- Version documentation
- Upgrade plan 