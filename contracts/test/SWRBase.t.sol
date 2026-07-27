// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SWRVault} from "../src/SWRVault.sol";
import {IkrarAkadNFT} from "../src/IkrarAkadNFT.sol";
import {WstETHAdapter} from "../src/adapters/WstETHAdapter.sol";
import {WeETHAdapter} from "../src/adapters/WeETHAdapter.sol";
import {IYieldAdapter} from "../src/interfaces/IYieldAdapter.sol";
import {ISwapRouter, IWETH} from "../src/interfaces/ISwapRouter.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IStETH, IWstETH, IEETH, IWeETH, IEtherFiLiquidityPool} from "../src/interfaces/ILST.sol";

import {MockIDRX} from "../src/mocks/MockIDRX.sol";
import {MockWETH} from "../src/mocks/MockWETH.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockStETH} from "../src/mocks/MockStETH.sol";
import {MockEETH, MockEtherFiLiquidityPool} from "../src/mocks/MockEETH.sol";
import {MockWstETH, MockWeETH} from "../src/mocks/MockWrappedLST.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";

/// @notice Shared fixture: the whole SWR stack on mocks.
///
/// IDRX is deliberately given 2 decimals here. Pairing a 2-decimal asset with 18-decimal ETH is a
/// far harsher exercise of the vault's normalisation math than another 18-decimal token would be,
/// and wrong-decimal handling is the single most common way money silently vanishes.
abstract contract SWRBase is Test {
    uint8 internal constant IDRX_DECIMALS = 2;
    uint8 internal constant FEED_DECIMALS = 8;

    /// @dev ETH/IDR ~ Rp 32,000,000 — roughly ETH/USD 1963 (the live Sepolia feed) x USD/IDR 16,300.
    int256 internal constant ETH_IDRX_PRICE = int256(32_000_000) * int256(10) ** FEED_DECIMALS;

    uint256 internal constant TENOR_SHORT = 10 minutes;
    uint256 internal constant TENOR_MID = 30 minutes;
    uint256 internal constant TENOR_LONG = 1 hours;
    uint256 internal constant UNBONDING = 5 minutes;

    uint256 internal constant W_WSTETH = 4_000; // 40%
    uint256 internal constant W_WEETH = 3_000; // 30%
    // remaining 30% stays as idle IDRX — the stable leg

    MockIDRX internal idrx;
    MockWETH internal weth;
    MockAggregator internal feed;
    MockStETH internal stETH;
    MockWstETH internal wstETH;
    MockEETH internal eETH;
    MockEtherFiLiquidityPool internal etherFiPool;
    MockWeETH internal weETH;
    MockSwapRouter internal router;
    IkrarAkadNFT internal akad;
    SWRVault internal vault;
    WstETHAdapter internal wstAdapter;
    WeETHAdapter internal weETHAdapter;

    address internal owner = makeAddr("owner");
    address internal nadzir = makeAddr("nadzir");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal keeper = makeAddr("keeper");

    function setUp() public virtual {
        idrx = new MockIDRX(IDRX_DECIMALS);
        weth = new MockWETH();
        feed = new MockAggregator(FEED_DECIMALS, "ETH / IDRX", ETH_IDRX_PRICE);

        stETH = new MockStETH();
        wstETH = new MockWstETH(stETH);

        eETH = new MockEETH();
        etherFiPool = new MockEtherFiLiquidityPool(eETH);
        eETH.setLiquidityPool(address(etherFiPool));
        weETH = new MockWeETH(eETH);

        router = new MockSwapRouter(IERC20(address(idrx)), IERC20(address(weth)), IAggregatorV3(address(feed)));
        router.setEthPegged(address(stETH), true);
        router.setEthPegged(address(eETH), true);

        akad = new IkrarAkadNFT(IDRX_DECIMALS, "IDRX");

        uint256[] memory tenors = new uint256[](3);
        tenors[0] = TENOR_SHORT;
        tenors[1] = TENOR_MID;
        tenors[2] = TENOR_LONG;

        vault = new SWRVault(
            IERC20(address(idrx)),
            IWETH(address(weth)),
            ISwapRouter(address(router)),
            IAggregatorV3(address(feed)),
            akad,
            nadzir,
            tenors,
            UNBONDING,
            owner
        );

        akad.setVault(address(vault));

        wstAdapter = new WstETHAdapter(
            address(vault),
            ISwapRouter(address(router)),
            IWETH(address(weth)),
            IStETH(address(stETH)),
            IWstETH(address(wstETH))
        );
        weETHAdapter = new WeETHAdapter(
            address(vault),
            ISwapRouter(address(router)),
            IWETH(address(weth)),
            IEETH(address(eETH)),
            IWeETH(address(weETH)),
            IEtherFiLiquidityPool(address(etherFiPool))
        );

        IYieldAdapter[] memory adapters = new IYieldAdapter[](2);
        adapters[0] = IYieldAdapter(address(wstAdapter));
        adapters[1] = IYieldAdapter(address(weETHAdapter));
        uint256[] memory weights = new uint256[](2);
        weights[0] = W_WSTETH;
        weights[1] = W_WEETH;

        vm.prank(owner);
        vault.setAdapters(adapters, weights);

        _fundRouter();

        idrx.mint(alice, idr(50_000_000));
        idrx.mint(bob, idr(50_000_000));
    }

    /// @dev The router is a pre-funded desk, not an AMM, so it needs deep inventory of both legs.
    function _fundRouter() internal {
        idrx.mint(address(router), idr(1_000_000_000_000));
        vm.deal(address(this), 100_000 ether);
        weth.deposit{value: 50_000 ether}();
        weth.transfer(address(router), 50_000 ether);
    }

    // --- helpers ----------------------------------------------------------

    /// @notice Whole rupiah -> IDRX base units.
    function idr(uint256 whole) internal pure returns (uint256) {
        return whole * (10 ** IDRX_DECIMALS);
    }

    function _deposit(address who, uint256 amount, uint256 tenorIndex) internal returns (uint256 positionId) {
        vm.startPrank(who);
        idrx.approve(address(vault), amount);
        positionId = vault.deposit(amount, tenorIndex);
        vm.stopPrank();
    }

    /// @dev Simulate validator rewards landing on both legs.
    function _accrueYield(uint256 bps) internal {
        stETH.accrueBps(bps);
        eETH.accrueBps(bps);
    }

    function _setSpread(uint256 bps) internal {
        router.setSpreadBps(bps);
    }

    /// @dev Re-publish the CURRENT price, not the starting constant. Refreshing to the constant
    ///      would silently undo any price move a test had set up, making a crash scenario look
    ///      like a healthy one.
    function _refreshOracle() internal {
        (, int256 current,,,) = feed.latestRoundData();
        feed.setAnswer(current);
    }

    /// @notice Move the ETH/IDRX price. Survives subsequent `_warp` calls.
    function _setPrice(int256 newPrice) internal {
        feed.setAnswer(newPrice);
    }

    function _warp(uint256 secs) internal {
        vm.warp(block.timestamp + secs);
        _refreshOracle();
    }
}
