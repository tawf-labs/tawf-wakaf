// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {MockRebasingLST} from "./MockRebasingLST.sol";

/// @notice TESTNET ONLY. ether.fi eETH. Unlike Lido, ether.fi's ETH entrypoint is a
/// separate LiquidityPool contract rather than the token itself — mirrored here so the
/// WeETHAdapter's call path matches mainnet.
/// NEVER deploy to mainnet.
contract MockEETH is MockRebasingLST {
    address public liquidityPool;

    error OnlyLiquidityPool();

    constructor() MockRebasingLST("ether.fi ETH", "eETH") {}

    function setLiquidityPool(address _pool) external {
        require(liquidityPool == address(0), "already set");
        liquidityPool = _pool;
    }

    function mintFor(address to, uint256 ethAmount) external returns (uint256) {
        if (msg.sender != liquidityPool) revert OnlyLiquidityPool();
        return _mintShares(to, ethAmount);
    }

    receive() external payable {}
}

/// @notice TESTNET ONLY. Mirrors ether.fi's LiquidityPool.deposit() entrypoint.
contract MockEtherFiLiquidityPool {
    MockEETH public immutable eETH;

    constructor(MockEETH _eETH) {
        eETH = _eETH;
    }

    /// @notice Stake ETH, receive eETH. Matches ether.fi's signature.
    function deposit() external payable returns (uint256) {
        uint256 shares = eETH.mintFor(msg.sender, msg.value);
        (bool ok,) = address(eETH).call{value: msg.value}("");
        require(ok, "eETH funding failed");
        return shares;
    }

    receive() external payable {}
}
