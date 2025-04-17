# Testing Guide

## Overview
This guide covers testing procedures for the Renewable Energy Co-Ownership Platform smart contracts.

## Test Environment Setup

### Prerequisites
- Node.js v18+
- Hardhat
- Ethers.js
- Chai

### Installation
```bash
cd blockchain
npm install
```

## Test Structure

### Unit Tests
Located in `test/*.test.js`
- Individual contract functionality
- Isolated testing environment
- Mock dependencies when needed

### Integration Tests
Located in `test/ContractIntegration.test.js`
- Contract interactions
- Complete workflows
- Real dependencies

### Security Tests
Located in `test/Security.test.js`
- Access control
- Input validation
- Edge cases
- Attack scenarios

## Running Tests

### All Tests
```bash
npx hardhat test
```

### Specific Test File
```bash
npx hardhat test test/RevenueDistributor.test.js
```

### With Gas Reporter
```bash
REPORT_GAS=true npx hardhat test
```

### With Coverage
```bash
npx hardhat coverage
```

## Test Categories

### 1. Functionality Tests
- Basic operations
- Expected workflows
- State changes
- Event emissions

### 2. Access Control Tests
- Owner functions
- Role-based access
- Unauthorized access attempts
- Permission changes

### 3. Input Validation Tests
- Valid inputs
- Invalid inputs
- Boundary conditions
- Type checking

### 4. Integration Tests
- Contract interactions
- Token flows
- Revenue distribution
- Investment processes

### 5. Security Tests
- Reentrancy
- Integer overflow/underflow
- Access control
- Denial of service

### 6. Gas Optimization Tests
- Function gas usage
- Storage patterns
- Loop optimizations
- Batch operations

## Test Coverage Requirements

### Minimum Coverage
- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%

### Critical Areas
- Revenue distribution: 100%
- Token operations: 100%
- Access control: 100%
- Fund management: 100%

## Writing Tests

### Test Structure
```javascript
describe("Contract", function() {
    before(async function() {
        // One-time setup
    });

    beforeEach(async function() {
        // Setup before each test
    });

    it("should do something", async function() {
        // Test case
    });

    after(async function() {
        // Cleanup
    });
});
```

### Best Practices
1. Test one thing per test case
2. Use descriptive test names
3. Group related tests
4. Mock external dependencies
5. Test edge cases
6. Verify events
7. Check state changes

### Example Test Case
```javascript
it("should distribute revenue correctly", async function() {
    // Setup
    const amount = ethers.parseEther("1.0");
    await token.mint(user1.address, amount);

    // Action
    await distributor.distributeRevenue(projectId, { value: amount });

    // Verification
    const balance = await token.balanceOf(user1.address);
    expect(balance).to.equal(amount);
    
    // Event verification
    await expect(tx)
        .to.emit(distributor, "RevenueDistributed")
        .withArgs(projectId, amount);
});
```

## Debugging Tests

### Console Logging
```javascript
console.log("Value:", await contract.getValue());
```

### Hardhat Console
```javascript
await hre.run("console");
```

### Trace Transaction
```javascript
await hre.network.provider.send("debug_traceTransaction", [txHash]);
```

## Common Issues and Solutions

### 1. Gas Issues
- Use `{gasLimit: 1000000}` for complex operations
- Enable gas reporter for optimization
- Batch operations when possible

### 2. Timing Issues
- Use `evm_increaseTime` for time-dependent tests
- Reset blockchain state between tests
- Be aware of block timestamps

### 3. State Issues
- Reset contract state in `beforeEach`
- Use clean fixture for each test
- Avoid state dependencies between tests

## Continuous Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test
      - name: Run coverage
        run: npm run coverage
```

### Coverage Reports
- Generated in `coverage/` directory
- HTML report for detailed analysis
- Integration with Codecov/Coveralls

## Security Testing Tools

### Static Analysis
- Slither
- Mythril
- Solhint

### Dynamic Analysis
- Echidna
- Manticore
- Scribble

## Performance Testing

### Gas Optimization
```bash
REPORT_GAS=true npx hardhat test
```

### Benchmark Tests
```javascript
describe("Gas Benchmarks", function() {
    it("should be gas efficient", async function() {
        const tx = await contract.function();
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.be.below(100000);
    });
});
``` 