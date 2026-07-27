// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IYieldAdapter} from "../interfaces/IYieldAdapter.sol";
import {ISwapRouter, IWETH} from "../interfaces/ISwapRouter.sol";

/// @notice Shared machinery for every LST venue in the basket.
///
/// The ETH leg is identical across venues — stake ETH, hold a non-rebasing wrapper, exit
/// through a DEX because LST withdrawal queues take days. Only three things differ per
/// protocol, so only those three are abstract: how to stake, how to unwrap, and how to read
/// the rate.
///
/// Holds no accounting of its own. The vault is the single source of truth for principal;
/// this contract's entire state is "how much LST do I hold", readable from the token itself.
abstract contract BaseLSTAdapter is IYieldAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable vault;
    ISwapRouter public immutable router;
    IWETH public immutable weth;

    event Staked(uint256 ethIn, uint256 lstOut);
    event Unstaked(uint256 lstIn, uint256 ethOut);

    error NotVault();
    error ZeroAmount();
    error EthTransferFailed();

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    constructor(address _vault, ISwapRouter _router, IWETH _weth) {
        if (_vault == address(0) || address(_router) == address(0) || address(_weth) == address(0)) {
            revert ZeroAmount();
        }
        vault = _vault;
        router = _router;
        weth = _weth;
    }

    // --- per-protocol hooks ----------------------------------------------

    /// @dev Stake ETH into the venue and wrap into the non-rebasing token.
    function _stakeAndWrap(uint256 ethAmount) internal virtual returns (uint256 lstOut);

    /// @dev Unwrap the non-rebasing token back to its rebasing underlying.
    function _unwrap(uint256 lstAmount) internal virtual returns (uint256 underlyingOut);

    /// @dev The rebasing underlying (stETH, eETH) — what unwrapping yields.
    function _underlying() internal view virtual returns (address);

    /// @dev Underlying per 1e18 of the wrapper. wstETH calls it `stEthPerToken`,
    ///      weETH calls it `getRate`; same number, different name.
    function _ratePerToken() internal view virtual returns (uint256);

    // --- IYieldAdapter ----------------------------------------------------

    function deposit() external payable onlyVault nonReentrant returns (uint256 lstReceived) {
        if (msg.value == 0) revert ZeroAmount();
        lstReceived = _stakeAndWrap(msg.value);
        emit Staked(msg.value, lstReceived);
    }

    function withdraw(uint256 lstAmount, uint256 minEthOut) external onlyVault nonReentrant returns (uint256 ethOut) {
        if (lstAmount == 0) revert ZeroAmount();

        uint256 underlyingAmount = _unwrap(lstAmount);

        // Exit via DEX. `minEthOut` comes from the vault and is never 0 —
        // an unbounded swap is a free sandwich (`security/SKILL.md`, MEV).
        address underlyingToken = _underlying();
        IERC20(underlyingToken).forceApprove(address(router), underlyingAmount);
        ethOut = router.swapExactInput(underlyingToken, address(weth), underlyingAmount, minEthOut, address(this));

        weth.withdraw(ethOut);

        emit Unstaked(lstAmount, ethOut);

        (bool ok,) = vault.call{value: ethOut}("");
        if (!ok) revert EthTransferFailed();
    }

    function totalAssetsETH() public view returns (uint256) {
        return (lstBalance() * _ratePerToken()) / 1e18;
    }

    function lstBalance() public view returns (uint256) {
        return IERC20(lst()).balanceOf(address(this));
    }

    function lst() public view virtual returns (address);

    function name() external view virtual returns (string memory);

    /// @dev Receives ETH from `weth.withdraw`.
    receive() external payable {}
}
