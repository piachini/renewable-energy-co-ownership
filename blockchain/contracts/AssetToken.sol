// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract AssetToken is ERC20, Ownable, Pausable {
    using Math for uint256;

    address private _minter;
    uint256 private _totalDividends;
    mapping(address => uint256) private _dividendCredits;
    mapping(address => uint256) private _lastClaimedDividends;
    address[] private _holders;
    mapping(address => bool) private _isHolder;
    uint256 private constant PRECISION = 1e18;

    event DividendsDistributed(uint256 amount);
    event DividendsClaimed(address indexed holder, uint256 amount);

    error OnlyMinter();
    error NoDividendsToClaim();
    error InsufficientBalance();
    error NoTokensMinted();
    error TransferFailed();

    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol)
    {
        _transferOwnership(msg.sender);
    }

    function minter() public view returns (address) {
        return _minter;
    }

    function setMinter(address minterAddress) public onlyOwner {
        _minter = minterAddress;
    }

    function mint(address to, uint256 amount) public whenNotPaused {
        if (msg.sender != _minter) revert OnlyMinter();
        _mint(to, amount);
        if (!_isHolder[to]) {
            _holders.push(to);
            _isHolder[to] = true;
        }
    }

    function burn(address from, uint256 amount) public whenNotPaused {
        if (msg.sender != _minter) revert OnlyMinter();
        if (balanceOf(from) < amount) revert InsufficientBalance();
        _burn(from, amount);
    }

    function distributeDividends() public payable whenNotPaused {
        if (msg.value == 0) revert InsufficientBalance();
        if (totalSupply() == 0) revert NoTokensMinted();

        _totalDividends += msg.value;
        uint256 dividendPerToken = (msg.value * PRECISION) / totalSupply();
        
        for (uint256 i = 0; i < _holders.length; i++) {
            address holder = _holders[i];
            uint256 holderBalance = balanceOf(holder);
            if (holderBalance > 0) {
                _dividendCredits[holder] += (dividendPerToken * holderBalance) / PRECISION;
            }
        }

        emit DividendsDistributed(msg.value);
    }

    function claimDividends() public whenNotPaused {
        uint256 claimable = getClaimableDividends(msg.sender);
        if (claimable == 0) revert NoDividendsToClaim();

        _dividendCredits[msg.sender] = 0;
        _lastClaimedDividends[msg.sender] = _totalDividends;

        (bool success, ) = payable(msg.sender).call{value: claimable}("");
        if (!success) revert TransferFailed();

        emit DividendsClaimed(msg.sender, claimable);
    }

    function getClaimableDividends(address account) public view returns (uint256) {
        return _dividendCredits[account];
    }

    function getTotalDividends() public view returns (uint256) {
        return _totalDividends;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);

        if (from != address(0) && to != address(0)) {
            if (!_isHolder[to]) {
                _holders.push(to);
                _isHolder[to] = true;
            }

            uint256 fromBalance = balanceOf(from);
            if (fromBalance > 0) {
                uint256 unclaimedDividends = _dividendCredits[from];
                uint256 dividendsToTransfer = (unclaimedDividends * amount) / fromBalance;
                _dividendCredits[from] = unclaimedDividends - dividendsToTransfer;
                _dividendCredits[to] += dividendsToTransfer;
            }
        }
    }

    receive() external payable {
        distributeDividends();
    }
}

