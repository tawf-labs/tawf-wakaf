// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISwapRouter, IWETH} from "../interfaces/ISwapRouter.sol";
import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

/// @notice TESTNET ONLY. Pre-funded swap desk covering the two routes SWR needs:
///
///   1. IDRX <-> WETH        priced off the ETH/IDRX oracle
///   2. stETH/eETH -> WETH   priced 1:1, since a rebasing LST tracks ETH by construction
///
/// Route 2 is what lets one adapter implementation work everywhere. Real Lido cannot be
/// exited instantly — the withdrawal queue takes days, and on Sepolia it is paused outright
/// (`isPaused: true`, verified) — so production adapters exit through a DEX instead. Modelling
/// that as a swap here keeps the mainnet and testnet call paths identical.
///
/// A pre-funded reserve, not an AMM: no price impact of its own, so tests isolate the vault's
/// slippage-floor logic from curve mechanics. `spreadBps` is the lever that proves
/// `minAmountOut` actually bites rather than silently underfilling.
///
/// NEVER deploy to mainnet.
contract MockSwapRouter is ISwapRouter {
    using SafeERC20 for IERC20;

    IERC20 public immutable idrx;
    IERC20 public immutable weth;
    IAggregatorV3 public immutable ethIdrxFeed;

    uint8 private immutable _idrxDecimals;
    uint8 private immutable _feedDecimals;

    /// @notice Tokens treated as 1:1 with ETH (WETH, stETH, eETH).
    mapping(address => bool) public ethPegged;

    /// @notice Simulated spread taken off every swap, in basis points.
    uint256 public spreadBps = 30; // 0.30%, comparable to a Uniswap 0.3% pool

    address public owner;

    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event EthPeggedSet(address indexed token, bool pegged);

    error NotOwner();
    error UnsupportedPair();
    error InsufficientOutput(uint256 got, uint256 minWanted);
    error InsufficientLiquidity(address token, uint256 need, uint256 have);
    error BadPrice();

    constructor(IERC20 _idrx, IERC20 _weth, IAggregatorV3 _feed) {
        idrx = _idrx;
        weth = _weth;
        ethIdrxFeed = _feed;
        _idrxDecimals = IERC20Metadata(address(_idrx)).decimals();
        _feedDecimals = _feed.decimals();
        owner = msg.sender;
        ethPegged[address(_weth)] = true;
    }

    function setEthPegged(address token, bool pegged) external {
        if (msg.sender != owner) revert NotOwner();
        ethPegged[token] = pegged;
        emit EthPeggedSet(token, pegged);
    }

    function setSpreadBps(uint256 bps) external {
        if (msg.sender != owner) revert NotOwner();
        require(bps <= 10_000, "spread too high");
        spreadBps = bps;
    }

    /// @notice TESTNET: top the desk up with WETH inventory. Permissionless.
    /// @dev A full deposit-then-exit cycle pays WETH out twice and takes it back once, so
    ///      inventory drains with use. On a public testnet the deployer will not always be around
    ///      to refill, so anyone can.
    function fundWithEth() external payable {
        IWETH(address(weth)).deposit{value: msg.value}();
    }

    /// @notice TESTNET: seed IDRX inventory. The mock token has an open faucet anyway.
    receive() external payable {
        IWETH(address(weth)).deposit{value: msg.value}();
    }

    function _price() internal view returns (uint256) {
        (, int256 answer,,,) = ethIdrxFeed.latestRoundData();
        if (answer <= 0) revert BadPrice();
        return uint256(answer);
    }

    /// @notice Quote without executing. The vault derives its `minAmountOut` from this.
    function quote(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        uint256 gross;

        if (ethPegged[tokenIn] && ethPegged[tokenOut]) {
            // Both track ETH 1:1 and share 18 decimals.
            gross = amountIn;
        } else if (ethPegged[tokenIn] && tokenOut == address(idrx)) {
            // wei -> IDRX base units. Multiply before divide throughout.
            gross = (amountIn * _price() * (10 ** _idrxDecimals)) / (10 ** _feedDecimals) / 1e18;
        } else if (tokenIn == address(idrx) && ethPegged[tokenOut]) {
            gross = (amountIn * (10 ** _feedDecimals) * 1e18) / _price() / (10 ** _idrxDecimals);
        } else {
            revert UnsupportedPair();
        }

        return gross - ((gross * spreadBps) / 10_000);
    }

    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut) {
        amountOut = quote(tokenIn, tokenOut, amountIn);
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);

        uint256 have = IERC20(tokenOut).balanceOf(address(this));
        if (have < amountOut) revert InsufficientLiquidity(tokenOut, amountOut, have);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit Swapped(tokenIn, tokenOut, amountIn, amountOut);
    }
}
