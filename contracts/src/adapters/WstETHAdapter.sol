// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {BaseLSTAdapter} from "./BaseLSTAdapter.sol";
import {IStETH, IWstETH} from "../interfaces/ILST.sol";
import {ISwapRouter, IWETH} from "../interfaces/ISwapRouter.sol";

/// @notice Lido leg of the SWR basket: ETH -> stETH -> wstETH.
///
/// Verified mainnet targets (fork tests run against these):
///   stETH  0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
///   wstETH 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0   stEthPerToken 1.2402 and rising
///
/// Deliberately NOT pointed at Lido's Sepolia deployment. That deployment is deprecated by
/// Lido themselves and verified dead onchain: the rate has been frozen at 1.0377 with zero
/// rebase events for roughly a year, and the withdrawal queue is paused. Wiring it up would
/// produce a vault that never earns and never returns principal.
contract WstETHAdapter is BaseLSTAdapter {
    using SafeERC20 for IERC20;

    IStETH public immutable stETH;
    IWstETH public immutable wstETH;

    constructor(address _vault, ISwapRouter _router, IWETH _weth, IStETH _stETH, IWstETH _wstETH)
        BaseLSTAdapter(_vault, _router, _weth)
    {
        stETH = _stETH;
        wstETH = _wstETH;
    }

    function _stakeAndWrap(uint256 ethAmount) internal override returns (uint256) {
        stETH.submit{value: ethAmount}(address(0));

        // Wrap the stETH actually received, not the ETH sent. Lido's share rounding means
        // these differ by a wei or two, and wrapping a figure the balance can't cover reverts.
        uint256 stBalance = IERC20(address(stETH)).balanceOf(address(this));
        IERC20(address(stETH)).forceApprove(address(wstETH), stBalance);
        return wstETH.wrap(stBalance);
    }

    function _unwrap(uint256 lstAmount) internal override returns (uint256) {
        return wstETH.unwrap(lstAmount);
    }

    function _underlying() internal view override returns (address) {
        return address(stETH);
    }

    function _ratePerToken() internal view override returns (uint256) {
        return wstETH.stEthPerToken();
    }

    function lst() public view override returns (address) {
        return address(wstETH);
    }

    function name() external pure override returns (string memory) {
        return "Lido wstETH";
    }
}
