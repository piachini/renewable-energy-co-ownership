// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ProjectRegistry.sol";

contract Marketplace is Ownable, Pausable, ReentrancyGuard {
    struct Listing {
        uint256 id;
        uint256 projectId;
        address seller;
        uint256 tokenAmount;
        uint256 pricePerToken;
        uint256 expirationTime;
        bool isActive;
    }

    struct Order {
        uint256 id;
        uint256 listingId;
        address buyer;
        uint256 tokenAmount;
        uint256 totalPrice;
        OrderStatus status;
    }

    enum OrderStatus {
        Created,
        Completed,
        Cancelled
    }

    ProjectRegistry public immutable projectRegistry;
    address public feeCollector;
    uint256 public feePercentage; // Base 10000 (e.g., 250 = 2.5%)
    uint256 public listingCount;
    uint256 public orderCount;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Order) public orders;

    event ListingCreated(uint256 indexed listingId, uint256 indexed projectId, address seller, uint256 tokenAmount, uint256 pricePerToken);
    event ListingCancelled(uint256 indexed listingId);
    event OrderCreated(uint256 indexed orderId, uint256 indexed listingId, address buyer, uint256 tokenAmount, uint256 totalPrice);
    event OrderCompleted(uint256 indexed orderId);
    event OrderCancelled(uint256 indexed orderId);
    event FeeCollectorUpdated(address indexed newFeeCollector);
    event FeePercentageUpdated(uint256 newFeePercentage);

    error InvalidProject();
    error ProjectNotFound();
    error TokenTransferFailed();
    error EthTransferFailed();
    error TokenNotApproved();
    error InsufficientTokenBalance();
    error InvalidPrice();
    error InvalidAmount();
    error InvalidDuration();
    error ListingNotFound();
    error ListingInactive();
    error ListingExpired();
    error NotListingOwner();
    error OrderNotFound();
    error OrderNotActive();
    error InvalidFeeCollector();
    error InvalidFeePercentage();
    error InsufficientPayment();

    constructor(address _feeCollector, address _projectRegistry) {
        if (_feeCollector == address(0)) revert InvalidFeeCollector();
        if (_projectRegistry == address(0)) revert InvalidProject();
        feeCollector = _feeCollector;
        projectRegistry = ProjectRegistry(_projectRegistry);
    }

    function setFeeCollector(address _feeCollector) external onlyOwner {
        if (_feeCollector == address(0)) revert InvalidFeeCollector();
        feeCollector = _feeCollector;
        emit FeeCollectorUpdated(_feeCollector);
    }

    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        if (_feePercentage > 1000) revert InvalidFeePercentage(); // Max 10%
        feePercentage = _feePercentage;
        emit FeePercentageUpdated(_feePercentage);
    }

    function createListing(
        uint256 projectId,
        uint256 tokenAmount,
        uint256 pricePerToken,
        uint256 duration
    ) external whenNotPaused nonReentrant {
        if (pricePerToken == 0 || pricePerToken > 1e27) revert InvalidPrice();
        if (tokenAmount == 0) revert InvalidAmount();
        if (duration == 0) revert InvalidDuration();

        (
            ProjectRegistry.ProjectBase memory base,
            ,
            ProjectRegistry.ProjectTechnical memory technical
        ) = _validateProject(projectId);

        _validateTokenBalance(technical.tokenAddress, msg.sender, tokenAmount);

        uint256 listingId = listingCount++;
        listings[listingId] = Listing({
            id: listingId,
            projectId: projectId,
            seller: msg.sender,
            tokenAmount: tokenAmount,
            pricePerToken: pricePerToken,
            expirationTime: block.timestamp + duration,
            isActive: true
        });

        emit ListingCreated(listingId, projectId, msg.sender, tokenAmount, pricePerToken);
    }

    function cancelListing(uint256 listingId) external whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (!listing.isActive) revert ListingInactive();
        if (listing.seller != msg.sender) revert NotListingOwner();

        listing.isActive = false;
        emit ListingCancelled(listingId);
    }

    function createOrder(uint256 listingId) external payable whenNotPaused nonReentrant {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        if (!listing.isActive) revert ListingInactive();
        if (block.timestamp >= listing.expirationTime) revert ListingExpired();

        uint256 totalPrice = listing.tokenAmount * listing.pricePerToken;
        if (msg.value < totalPrice) revert InsufficientPayment();

        uint256 orderId = orderCount++;
        orders[orderId] = Order({
            id: orderId,
            listingId: listingId,
            buyer: msg.sender,
            tokenAmount: listing.tokenAmount,
            totalPrice: totalPrice,
            status: OrderStatus.Created
        });

        listing.isActive = false;

        emit OrderCreated(orderId, listingId, msg.sender, listing.tokenAmount, totalPrice);
    }

    function completeOrder(uint256 orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        if (order.id != orderId) revert OrderNotFound();
        if (order.status != OrderStatus.Created) revert OrderNotActive();
        if (order.buyer != msg.sender) revert NotListingOwner();

        Listing storage listing = listings[order.listingId];
        (
            ,
            ,
            ProjectRegistry.ProjectTechnical memory technical
        ) = _validateProject(listing.projectId);

        uint256 feeAmount = (order.totalPrice * feePercentage) / 10000;
        uint256 sellerAmount = order.totalPrice - feeAmount;

        // Transfer tokens to buyer
        bool success = IERC20(technical.tokenAddress).transferFrom(
            listing.seller,
            order.buyer,
            order.tokenAmount
        );
        if (!success) revert TokenTransferFailed();

        // Transfer ETH to seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        if (!sellerSuccess) revert EthTransferFailed();

        // Transfer fee to fee collector
        (bool feeSuccess, ) = payable(feeCollector).call{value: feeAmount}("");
        if (!feeSuccess) revert EthTransferFailed();

        order.status = OrderStatus.Completed;
        emit OrderCompleted(orderId);
    }

    function cancelOrder(uint256 orderId) external whenNotPaused nonReentrant {
        Order storage order = orders[orderId];
        if (order.id != orderId) revert OrderNotFound();
        if (order.status != OrderStatus.Created) revert OrderNotActive();
        if (order.buyer != msg.sender) revert NotListingOwner();

        order.status = OrderStatus.Cancelled;
        listings[order.listingId].isActive = true;

        (bool success, ) = payable(msg.sender).call{value: order.totalPrice}("");
        if (!success) revert EthTransferFailed();

        emit OrderCancelled(orderId);
    }

    function _validateProject(uint256 projectId) internal view returns (
        ProjectRegistry.ProjectBase memory base,
        ProjectRegistry.ProjectFinancials memory financials,
        ProjectRegistry.ProjectTechnical memory technical
    ) {
        try projectRegistry.getProjectDetails(projectId) returns (
            ProjectRegistry.ProjectBase memory _base,
            ProjectRegistry.ProjectFinancials memory _financials,
            ProjectRegistry.ProjectTechnical memory _technical
        ) {
            if (_base.status != ProjectRegistry.ProjectStatus.Active) revert InvalidProject();
            return (_base, _financials, _technical);
        } catch {
            revert ProjectNotFound();
        }
    }

    function _validateTokenBalance(address tokenAddress, address account, uint256 amount) internal view {
        IERC20 token = IERC20(tokenAddress);
        if (token.balanceOf(account) < amount) revert InsufficientTokenBalance();
        if (token.allowance(account, address(this)) < amount) revert TokenNotApproved();
    }

    function getListingDetails(uint256 listingId) external view returns (Listing memory) {
        Listing storage listing = listings[listingId];
        if (listing.id != listingId) revert ListingNotFound();
        return listing;
    }

    function getOrderDetails(uint256 orderId) external view returns (Order memory) {
        Order storage order = orders[orderId];
        if (order.id != orderId) revert OrderNotFound();
        return order;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}