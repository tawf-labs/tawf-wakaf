// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Lido stETH. Rebasing: `balanceOf` grows as validator rewards land.
/// Mainnet: 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84
interface IStETH is IERC20 {
    /// @param _referral referral address, may be address(0)
    /// @return the amount of stETH shares minted
    function submit(address _referral) external payable returns (uint256);
    function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256);
    function getSharesByPooledEth(uint256 _ethAmount) external view returns (uint256);
}

/// @notice Lido wstETH. Non-rebasing wrapper — balance is constant, the RATE grows.
/// `security/SKILL.md`: never hold rebasing stETH in a vault, hold the wrapped version.
/// Mainnet: 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0  (stEthPerToken 1.2402, verified growing)
/// Sepolia: 0xB82381A3fBD3FaFA77B3a7bE693342618240067b  (frozen at 1.0377 — deployment deprecated)
interface IWstETH is IERC20 {
    function wrap(uint256 _stETHAmount) external returns (uint256);
    function unwrap(uint256 _wstETHAmount) external returns (uint256);
    /// @return how much stETH one wstETH is worth, 18 decimals
    function stEthPerToken() external view returns (uint256);
    function getStETHByWstETH(uint256 _wstETHAmount) external view returns (uint256);
    function getWstETHByStETH(uint256 _stETHAmount) external view returns (uint256);
}

/// @notice ether.fi eETH. Rebasing, same shape as stETH.
/// Mainnet: 0x35fA164735182de50811E8e2E824cFb9B6118ac2
interface IEETH is IERC20 {}

/// @notice ether.fi LiquidityPool — the ETH entrypoint that mints eETH.
interface IEtherFiLiquidityPool {
    function deposit() external payable returns (uint256);
}

/// @notice ether.fi weETH. Non-rebasing wrapper. Same role as wstETH but different
/// function names — which is exactly why each LST gets its own thin adapter.
/// Mainnet: 0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee  (getRate 1.1001, verified growing)
interface IWeETH is IERC20 {
    function wrap(uint256 _eETHAmount) external returns (uint256);
    function unwrap(uint256 _weETHAmount) external returns (uint256);
    /// @return how much eETH one weETH is worth, 18 decimals
    function getRate() external view returns (uint256);
    function getEETHByWeETH(uint256 _weETHAmount) external view returns (uint256);
    function getWeETHByeETH(uint256 _eETHAmount) external view returns (uint256);
}
