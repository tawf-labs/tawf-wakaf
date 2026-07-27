// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice One staking venue in the SWR basket, denominated in ETH.
///
/// The vault knows nothing about Lido or ether.fi — only this interface. That is what
/// lets a Sepolia mock and a real mainnet integration be the same vault bytecode, and
/// what lets a third LST be added later without touching vault logic.
///
/// Adapters hold no accounting of their own beyond their LST balance; the vault is the
/// single source of truth for principal.
interface IYieldAdapter {
    /// @notice Stake `msg.value` ETH into the venue. Vault-only.
    /// @return lstReceived units of the non-rebasing LST now held by this adapter
    function deposit() external payable returns (uint256 lstReceived);

    /// @notice Liquidate `lstAmount` of LST back to ETH and forward it to the vault. Vault-only.
    /// @param minEthOut slippage floor — reverts below it. Never pass 0 (`security/SKILL.md`, MEV).
    /// @return ethOut ETH actually sent to the vault
    function withdraw(uint256 lstAmount, uint256 minEthOut) external returns (uint256 ethOut);

    /// @notice Book value of everything this adapter holds, in wei of ETH.
    /// @dev lstBalance * rate. A view over the LST's own exchange rate, never a DEX spot price.
    function totalAssetsETH() external view returns (uint256);

    /// @notice Raw non-rebasing LST balance held by this adapter.
    function lstBalance() external view returns (uint256);

    /// @notice The non-rebasing LST this adapter accumulates (wstETH, weETH, ...).
    function lst() external view returns (address);

    /// @notice Human label for UIs and events, e.g. "Lido wstETH".
    function name() external view returns (string memory);
}
