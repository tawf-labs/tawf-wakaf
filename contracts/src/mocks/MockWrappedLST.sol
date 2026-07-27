// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockRebasingLST} from "./MockRebasingLST.sol";

/// @notice TESTNET ONLY. Non-rebasing wrapper over a rebasing LST.
///
/// The wrapped balance IS the share count, so it never changes; all yield shows up as
/// growth in the share->underlying rate. That is precisely why a vault should hold the
/// wrapped form: `security/SKILL.md` warns that rebasing balances change without any
/// Transfer event, silently desyncing internal accounting.
///
/// NEVER deploy to mainnet.
abstract contract MockWrappedLST is ERC20 {
    using SafeERC20 for IERC20;

    MockRebasingLST public immutable underlying;

    error ZeroAmount();

    constructor(string memory _name, string memory _symbol, MockRebasingLST _underlying) ERC20(_name, _symbol) {
        underlying = _underlying;
    }

    /// @notice Lock underlying, mint wrapped 1:1 with shares.
    function wrap(uint256 underlyingAmount) external returns (uint256) {
        if (underlyingAmount == 0) revert ZeroAmount();
        uint256 shares = underlying.getSharesByPooledEth(underlyingAmount);
        IERC20(address(underlying)).safeTransferFrom(msg.sender, address(this), underlyingAmount);
        _mint(msg.sender, shares);
        return shares;
    }

    /// @notice Burn wrapped, release underlying at the current rate.
    function unwrap(uint256 wrappedAmount) external returns (uint256) {
        if (wrappedAmount == 0) revert ZeroAmount();
        uint256 underlyingAmount = underlying.getPooledEthByShares(wrappedAmount);
        _burn(msg.sender, wrappedAmount);
        IERC20(address(underlying)).safeTransfer(msg.sender, underlyingAmount);
        return underlyingAmount;
    }

    function _underlyingPerToken() internal view returns (uint256) {
        return underlying.getPooledEthByShares(1e18);
    }
}

/// @notice TESTNET ONLY. Lido wstETH ABI. Mainnet equivalent: 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0.
contract MockWstETH is MockWrappedLST {
    constructor(MockRebasingLST _stETH) MockWrappedLST("Wrapped liquid staked Ether 2.0", "wstETH", _stETH) {}

    function stEthPerToken() external view returns (uint256) {
        return _underlyingPerToken();
    }

    function getStETHByWstETH(uint256 a) external view returns (uint256) {
        return underlying.getPooledEthByShares(a);
    }

    function getWstETHByStETH(uint256 a) external view returns (uint256) {
        return underlying.getSharesByPooledEth(a);
    }
}

/// @notice TESTNET ONLY. ether.fi weETH ABI. Mainnet equivalent: 0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee.
/// Same mechanism as wstETH, different function names — the reason each LST gets its own adapter.
contract MockWeETH is MockWrappedLST {
    constructor(MockRebasingLST _eETH) MockWrappedLST("Wrapped eETH", "weETH", _eETH) {}

    function getRate() external view returns (uint256) {
        return _underlyingPerToken();
    }

    function getEETHByWeETH(uint256 a) external view returns (uint256) {
        return underlying.getPooledEthByShares(a);
    }

    function getWeETHByeETH(uint256 a) external view returns (uint256) {
        return underlying.getSharesByPooledEth(a);
    }
}
