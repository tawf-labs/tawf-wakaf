// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal exact-input swap, denominated in whole tokens in / tokens out.
///
/// SWR needs this because principal is held in IDRX while yield is earned in ETH —
/// every route in and out of the basket crosses that currency boundary.
///
/// On Sepolia this is `MockSwapRouter`, priced off the same oracle the vault uses.
/// On mainnet you would implement it as a thin wrapper over Uniswap V3's
/// `exactInputSingle`, passing `minAmountOut` straight through to `amountOutMinimum`.
interface ISwapRouter {
    /// @param minAmountOut slippage floor. The vault always derives this from the oracle
    ///        and never passes 0 — an unbounded swap is a free sandwich for MEV searchers.
    function swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external returns (uint256 amountOut);
}

/// @notice Canonical WETH9. Sepolia: 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 (verified).
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}
