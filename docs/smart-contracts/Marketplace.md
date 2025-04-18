# Marketplace Smart Contract

## Overview
The Marketplace contract facilitates the trading of energy asset tokens between users. It provides functionality for creating listings, managing orders, and handling transactions with built-in fee collection.

## Features
- Asset token listing and management
- Order creation and execution
- Automated fee collection
- Transaction history tracking
- Pausable functionality for emergency stops
- Role-based access control

## Contract Details
- **License**: MIT
- **Solidity Version**: ^0.8.20
- **Dependencies**: 
  - OpenZeppelin Contracts
  - AssetToken
  - ProjectRegistry

## Data Structures

### Listing
```solidity
struct Listing {
    uint256 id;
    address seller;
    uint256 projectId;
    uint256 tokenAmount;
    uint256 pricePerToken;
    uint256 totalPrice;
    bool isActive;
    uint256 createdAt;
    uint256 expiresAt;
}
```

### Order
```solidity
struct Order {
    uint256 id;
    uint256 listingId;
    address buyer;
    uint256 tokenAmount;
    uint256 totalPrice;
    OrderStatus status;
    uint256 createdAt;
}
```

### OrderStatus
```solidity
enum OrderStatus {
    Pending,
    Completed,
    Cancelled
}
```

## State Variables
- `listings`: Mapping of listing IDs to Listing structs
- `orders`: Mapping of order IDs to Order structs
- `userListings`: Mapping of user addresses to their listing IDs
- `userOrders`: Mapping of user addresses to their order IDs
- `listingCount`: Counter for listing IDs
- `orderCount`: Counter for order IDs
- `feePercentage`: Fee percentage in basis points (1 = 0.01%)
- `feeCollector`: Address that receives collected fees

## Events
- `ListingCreated`: Emitted when a new listing is created
- `ListingCancelled`: Emitted when a listing is cancelled
- `OrderCreated`: Emitted when a new order is created
- `OrderCompleted`: Emitted when an order is completed
- `OrderCancelled`: Emitted when an order is cancelled
- `FeeUpdated`: Emitted when the fee percentage is updated
- `FeeCollectorUpdated`: Emitted when the fee collector address is updated

## Custom Errors
- `InvalidListing`: Invalid listing ID
- `InvalidOrder`: Invalid order ID
- `InsufficientBalance`: Insufficient funds for transaction
- `NotListingOwner`: Caller is not the listing owner
- `NotOrderBuyer`: Caller is not the order buyer
- `ListingExpired`: Listing has expired
- `ListingInactive`: Listing is not active
- `OrderNotPending`: Order is not in pending status
- `InvalidFeePercentage`: Invalid fee percentage
- `InvalidFeeCollector`: Invalid fee collector address
- `ZeroAmount`: Zero token amount
- `ZeroPrice`: Zero price per token

## Functions

### Constructor
```solidity
constructor(uint256 _feePercentage, address _feeCollector)
```
Initializes the contract with fee percentage and collector address.

### Listing Management
```solidity
function createListing(
    uint256 projectId,
    uint256 tokenAmount,
    uint256 pricePerToken,
    uint256 duration
) external
```
Creates a new listing for token sale.

```solidity
function cancelListing(uint256 listingId) external
```
Cancels an existing listing.

### Order Management
```solidity
function createOrder(uint256 listingId) external payable
```
Creates a new order for a listing.

```solidity
function completeOrder(uint256 orderId) external
```
Completes an order, transferring tokens and funds.

```solidity
function cancelOrder(uint256 orderId) external
```
Cancels an order and refunds the buyer.

### Admin Functions
```solidity
function setFeePercentage(uint256 _feePercentage) public
```
Updates the fee percentage.

```solidity
function setFeeCollector(address _feeCollector) public
```
Updates the fee collector address.

```solidity
function pause() public
```
Pauses the contract.

```solidity
function unpause() public
```
Unpauses the contract.

### View Functions
```solidity
function getUserListings(address user) external view returns (uint256[] memory)
```
Returns all listings created by a user.

```solidity
function getUserOrders(address user) external view returns (uint256[] memory)
```
Returns all orders created by a user.

```solidity
function getListingDetails(uint256 listingId) external view returns (...)
```
Returns detailed information about a listing.

```solidity
function getOrderDetails(uint256 orderId) external view returns (...)
```
Returns detailed information about an order.

## Security Considerations
1. **Access Control**
   - Only listing owners can cancel their listings
   - Only order buyers can cancel their orders
   - Only contract owner can update fees and pause contract

2. **Fund Management**
   - Secure token transfers using OpenZeppelin's ERC20
   - Safe ETH transfers with reentrancy protection
   - Proper fee calculation and distribution

3. **Input Validation**
   - Zero amount and price checks
   - Project existence and status verification
   - Token balance verification
   - Order status validation

4. **Emergency Controls**
   - Pausable functionality for emergency stops
   - Fee adjustment capability
   - Fee collector address update capability

## Integration Guide
1. **Contract Setup**
   ```solidity
   // Deploy Marketplace
   Marketplace marketplace = new Marketplace(100, feeCollectorAddress);
   
   // Set up token approval
   assetToken.approve(marketplaceAddress, amount);
   ```

2. **Creating a Listing**
   ```solidity
   marketplace.createListing(
       projectId,
       tokenAmount,
       pricePerToken,
       duration
   );
   ```

3. **Creating an Order**
   ```solidity
   marketplace.createOrder{value: totalPrice}(listingId);
   ```

4. **Completing an Order**
   ```solidity
   marketplace.completeOrder(orderId);
   ```

## Testing Guide
1. **Unit Tests**
   - Listing creation and cancellation
   - Order creation and completion
   - Fee calculation and distribution
   - Access control verification

2. **Integration Tests**
   - Token transfer verification
   - ETH transfer verification
   - Project registry integration
   - Asset token integration

## Gas Usage
- `createListing`: ~150,000 gas
- `cancelListing`: ~30,000 gas
- `createOrder`: ~70,000 gas
- `completeOrder`: ~100,000 gas
- `cancelOrder`: ~40,000 gas

## Known Issues and Limitations
1. **Fixed Fee Structure**
   - Fee percentage is uniform for all transactions
   - No dynamic fee adjustment based on volume

2. **Order Completion**
   - Only seller can complete orders
   - No automatic completion after expiration

3. **Listing Duration**
   - Fixed duration at creation
   - No extension capability

## Upgrade Path
1. **Dynamic Fees**
   - Implement volume-based fee structure
   - Add tiered fee system

2. **Order Automation**
   - Add automatic order completion
   - Implement escrow system

3. **Listing Management**
   - Add listing extension functionality
   - Implement bulk listing creation

4. **Advanced Features**
   - Add auction functionality
   - Implement limit orders
   - Add price oracles 