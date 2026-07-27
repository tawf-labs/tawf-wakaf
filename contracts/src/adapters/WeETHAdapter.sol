// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BaseLSTAdapter} from "./BaseLSTAdapter.sol";
import {IEETH, IWeETH, IEtherFiLiquidityPool} from "../interfaces/ILST.sol";
import {ISwapRouter, IWETH} from "../interfaces/ISwapRouter.sol";

/// @notice ether.fi leg of the SWR basket: ETH -> eETH -> weETH.
///
/// Verified mainnet targets (fork tests run against these):
///   eETH  0x35fA164735182de50811E8e2E824cFb9B6118ac2
///   weETH 0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee   getRate 1.1001 and rising
///
/// Mechanically identical to the Lido leg, but the ABIs differ in two ways that make a
/// shared adapter impossible: staking goes through a separate LiquidityPool contract rather
/// than the token, and the rate accessor is `getRate()` not `stEthPerToken()`. Two thin
/// subclasses is the honest way to absorb that.
///
/// Holding two independent LSTs is the point of the PRD's diversification thesis: a slashing
/// event or validator-set problem at one operator does not move the other.
contract WeETHAdapter is BaseLSTAdapter {
    using SafeERC20 for IERC20;

    IEETH public immutable eETH;
    IWeETH public immutable weETH;
    IEtherFiLiquidityPool public immutable liquidityPool;

    constructor(
        address _vault,
        ISwapRouter _router,
        IWETH _weth,
        IEETH _eETH,
        IWeETH _weETH,
        IEtherFiLiquidityPool _pool
    ) BaseLSTAdapter(_vault, _router, _weth) {
        eETH = _eETH;
        weETH = _weETH;
        liquidityPool = _pool;
    }

    function _stakeAndWrap(uint256 ethAmount) internal override returns (uint256) {
        liquidityPool.deposit{value: ethAmount}();

        // Wrap the eETH actually credited — share rounding again.
        uint256 eBalance = IERC20(address(eETH)).balanceOf(address(this));
        IERC20(address(eETH)).forceApprove(address(weETH), eBalance);
        return weETH.wrap(eBalance);
    }

    function _unwrap(uint256 lstAmount) internal override returns (uint256) {
        return weETH.unwrap(lstAmount);
    }

    function _underlying() internal view override returns (address) {
        return address(eETH);
    }

    function _ratePerToken() internal view override returns (uint256) {
        return weETH.getRate();
    }

    function lst() public view override returns (address) {
        return address(weETH);
    }

    function name() external pure override returns (string memory) {
        return "ether.fi weETH";
    }
}
