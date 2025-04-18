// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./RevenueDistributor.sol";
import "./AssetToken.sol";

contract RevenueAutomation is Ownable, Pausable, ReentrancyGuard {
    struct AutomationConfig {
        bool autoDistribute;
        bool autoReinvest;
        uint256 reinvestPercentage;
        uint256 taxWithholding;
        address taxRecipient;
        uint256 lastDistribution;
        uint256 distributionInterval;
    }

    RevenueDistributor public revenueDistributor;
    AssetToken public assetToken;
    mapping(uint256 => AutomationConfig) public projectAutomation;
    mapping(address => mapping(uint256 => bool)) public investorAutoReinvest;
    mapping(address => mapping(uint256 => uint256)) public investorTaxWithholding;

    event AutomationConfigured(
        uint256 indexed projectId,
        bool autoDistribute,
        bool autoReinvest,
        uint256 reinvestPercentage,
        uint256 taxWithholding
    );
    event AutoDistributionExecuted(
        uint256 indexed projectId,
        uint256 amount,
        uint256 timestamp
    );
    event AutoReinvestmentExecuted(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );
    event TaxWithholdingUpdated(
        uint256 indexed projectId,
        address indexed investor,
        uint256 amount
    );

    error InvalidProject();
    error InvalidPercentage();
    error InvalidInterval();
    error NotProjectOwner();
    error DistributionTooSoon();
    error InsufficientBalance();
    error InvalidTaxRecipient();
    error AutoReinvestmentDisabled();
    error TooEarly();
    error TransferFailed();
    error NoRevenue();

    constructor(address payable _revenueDistributor, address payable _assetToken) {
        if (_revenueDistributor == address(0)) revert InvalidProject();
        if (_assetToken == address(0)) revert InvalidProject();
        revenueDistributor = RevenueDistributor(_revenueDistributor);
        assetToken = AssetToken(_assetToken);
    }

    function configureAutomation(
        uint256 projectId,
        bool _autoDistribute,
        bool _autoReinvest,
        uint256 _reinvestPercentage,
        uint256 _taxWithholding,
        address _taxRecipient,
        uint256 _distributionInterval
    ) external onlyOwner {
        if (_reinvestPercentage > 10000) revert InvalidPercentage(); // Max 100%
        if (_taxWithholding > 10000) revert InvalidPercentage(); // Max 100%
        if (_distributionInterval < 1 days) revert InvalidInterval();
        if (_taxRecipient == address(0)) revert InvalidTaxRecipient();

        projectAutomation[projectId] = AutomationConfig({
            autoDistribute: _autoDistribute,
            autoReinvest: _autoReinvest,
            reinvestPercentage: _reinvestPercentage,
            taxWithholding: _taxWithholding,
            taxRecipient: _taxRecipient,
            lastDistribution: block.timestamp,
            distributionInterval: _distributionInterval
        });

        emit AutomationConfigured(
            projectId,
            _autoDistribute,
            _autoReinvest,
            _reinvestPercentage,
            _taxWithholding
        );
    }

    function setInvestorAutoReinvest(
        uint256 projectId,
        bool _autoReinvest
    ) external {
        investorAutoReinvest[msg.sender][projectId] = _autoReinvest;
    }

    function executeAutoDistribution(
        uint256 projectId
    ) external whenNotPaused nonReentrant {
        AutomationConfig storage config = projectAutomation[projectId];
        if (!config.autoDistribute) revert InvalidProject();
        if (block.timestamp < config.lastDistribution + config.distributionInterval) {
            revert DistributionTooSoon();
        }

        uint256 balance = address(revenueDistributor).balance;
        if (balance == 0) revert InsufficientBalance();

        config.lastDistribution = block.timestamp;
        revenueDistributor.processDistributions(projectId);

        emit AutoDistributionExecuted(projectId, balance, block.timestamp);
    }

    function executeAutoReinvestment(
        uint256 projectId,
        address investor
    ) external whenNotPaused nonReentrant {
        if (!projectAutomation[projectId].autoReinvest) revert AutoReinvestmentDisabled();
        if (block.timestamp < projectAutomation[projectId].lastDistribution + projectAutomation[projectId].distributionInterval) {
            revert TooEarly();
        }

        // Get the latest distribution
        uint256 distributionId = revenueDistributor.distributionCount() - 1;
        
        // Calculate investor's share before claiming
        uint256 totalAmount = revenueDistributor.calculateShare(distributionId, investor);
        if (totalAmount == 0) revert NoRevenue();

        // Claim revenue for the investor
        revenueDistributor.claimRevenue(distributionId);
        
        // Calculate amounts based on investor's share
        uint256 reinvestAmount = (totalAmount * projectAutomation[projectId].reinvestPercentage) / 10000;
        uint256 taxAmount = (totalAmount * projectAutomation[projectId].taxWithholding) / 10000;
        uint256 netAmount = totalAmount - reinvestAmount - taxAmount;

        // Update tax withholding
        investorTaxWithholding[investor][projectId] += taxAmount;

        // Transfer tax to recipient
        if (taxAmount > 0) {
            (bool success, ) = payable(projectAutomation[projectId].taxRecipient).call{value: taxAmount}("");
            if (!success) revert TransferFailed();
        }

        // Transfer net amount to investor
        if (netAmount > 0) {
            (bool success, ) = payable(investor).call{value: netAmount}("");
            if (!success) revert TransferFailed();
        }

        // Reinvest the remaining amount
        if (reinvestAmount > 0) {
            revenueDistributor.receiveRevenue{value: reinvestAmount}(projectId);
        }

        projectAutomation[projectId].lastDistribution = block.timestamp;
        emit AutoReinvestmentExecuted(projectId, investor, reinvestAmount);
        emit TaxWithholdingUpdated(projectId, investor, taxAmount);
    }

    function getAutomationConfig(
        uint256 projectId
    ) external view returns (
        bool autoDistribute,
        bool autoReinvest,
        uint256 reinvestPercentage,
        uint256 taxWithholding,
        address taxRecipient,
        uint256 lastDistribution,
        uint256 distributionInterval
    ) {
        AutomationConfig storage config = projectAutomation[projectId];
        return (
            config.autoDistribute,
            config.autoReinvest,
            config.reinvestPercentage,
            config.taxWithholding,
            config.taxRecipient,
            config.lastDistribution,
            config.distributionInterval
        );
    }

    function getInvestorTaxWithholding(
        address investor,
        uint256 projectId
    ) external view returns (uint256) {
        return investorTaxWithholding[investor][projectId];
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    receive() external payable {
        // Accept ETH
    }
} 