// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockRebasingLST} from "./MockRebasingLST.sol";

/// @notice TESTNET ONLY. Mirrors Lido stETH's `submit(address)` entrypoint.
/// Real Sepolia stETH (0x3e3FE...) accepts deposits but its oracle is dormant — verified
/// zero rebase events for ~1 year — so it can never demonstrate yield. This can.
/// NEVER deploy to mainnet.
contract MockStETH is MockRebasingLST {
    constructor() MockRebasingLST("Liquid staked Ether 2.0", "stETH") {}

    /// @notice Stake ETH, receive stETH 1:1 at the current rate. Matches Lido's signature.
    /// @return the amount of shares minted
    function submit(address) external payable returns (uint256) {
        uint256 sharesBefore = totalShares;
        _mintShares(msg.sender, msg.value);
        return totalShares - sharesBefore;
    }

    /// @notice ETH held here backs the pool; the wrapper pulls it out on unwrap paths.
    receive() external payable {}
}
