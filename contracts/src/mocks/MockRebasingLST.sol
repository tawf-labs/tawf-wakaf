// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice TESTNET ONLY. Share-based rebasing LST, modelled on Lido stETH / ether.fi eETH.
///
/// Real stETH is not a plain ERC-20: balances are derived from an internal share count
/// divided by a total-pooled-ether figure that grows when rewards land. Modelling that
/// faithfully (rather than as a plain mintable token) is the point — it is what makes the
/// wrapper's rate move, and it keeps the adapter code identical against real Lido.
///
/// NEVER deploy to mainnet.
abstract contract MockRebasingLST is IERC20, IERC20Metadata {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    uint256 public totalShares;
    uint256 public totalPooledEther;

    mapping(address => uint256) public sharesOf;
    mapping(address => mapping(address => uint256)) private _allowances;

    /// @notice Emitted when simulated validator rewards land, growing every holder's balance.
    event Rebased(uint256 rewardWei, uint256 newTotalPooledEther);

    error ZeroAmount();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    // --- share math -------------------------------------------------------

    function getPooledEthByShares(uint256 _shares) public view returns (uint256) {
        if (totalShares == 0) return _shares;
        return (_shares * totalPooledEther) / totalShares;
    }

    function getSharesByPooledEth(uint256 _eth) public view returns (uint256) {
        if (totalPooledEther == 0) return _eth;
        return (_eth * totalShares) / totalPooledEther;
    }

    // --- ERC-20 over shares ----------------------------------------------

    function totalSupply() external view returns (uint256) {
        return totalPooledEther;
    }

    function balanceOf(address a) public view returns (uint256) {
        return getPooledEthByShares(sharesOf[a]);
    }

    function allowance(address o, address s) external view returns (uint256) {
        return _allowances[o][s];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            _allowances[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 shares = getSharesByPooledEth(amount);
        if (sharesOf[from] < shares) revert InsufficientBalance();
        sharesOf[from] -= shares;
        sharesOf[to] += shares;
        emit Transfer(from, to, amount);
    }

    // --- staking ----------------------------------------------------------

    /// @dev Shares are computed BEFORE the incoming ETH is added to the pool, otherwise
    ///      the depositor would dilute themselves against their own deposit.
    function _mintShares(address to, uint256 ethAmount) internal returns (uint256 shares) {
        if (ethAmount == 0) revert ZeroAmount();
        shares = getSharesByPooledEth(ethAmount);
        totalShares += shares;
        totalPooledEther += ethAmount;
        sharesOf[to] += shares;
        emit Transfer(address(0), to, ethAmount);
    }

    /// @notice TESTNET: simulate validator rewards arriving. Permissionless by design —
    ///         this is a faucet-grade lever so anyone can demo the yield-stripping flow.
    /// @param rewardWei ETH-equivalent rewards to add to the pool
    function accrue(uint256 rewardWei) external {
        if (rewardWei == 0) revert ZeroAmount();
        totalPooledEther += rewardWei;
        emit Rebased(rewardWei, totalPooledEther);
    }

    /// @notice TESTNET: grow the pool by a percentage, for convenient demos.
    /// @param bps basis points of growth, e.g. 500 = +5%
    function accrueBps(uint256 bps) external {
        uint256 reward = (totalPooledEther * bps) / 10_000;
        if (reward == 0) revert ZeroAmount();
        totalPooledEther += reward;
        emit Rebased(reward, totalPooledEther);
    }
}
