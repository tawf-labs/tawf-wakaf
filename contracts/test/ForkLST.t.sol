// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {WstETHAdapter} from "../src/adapters/WstETHAdapter.sol";
import {WeETHAdapter} from "../src/adapters/WeETHAdapter.sol";
import {ISwapRouter, IWETH} from "../src/interfaces/ISwapRouter.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IStETH, IWstETH, IEETH, IWeETH, IEtherFiLiquidityPool} from "../src/interfaces/ILST.sol";

import {MockIDRX} from "../src/mocks/MockIDRX.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";

/// @notice Fork tests against the REAL Lido and ether.fi deployments on Ethereum mainnet.
///
/// This is the layer that makes the Sepolia mocks honest. `testing/SKILL.md` is blunt about it:
/// mocking an external protocol hides integration bugs that only appear against real state. The
/// Sepolia deployment cannot prove the integration works, because Lido's Sepolia deployment is
/// deprecated and verifiably dead — the rate has been frozen for roughly a year and the withdrawal
/// queue is paused. So the proof lives here instead, against contracts that are actually alive.
///
/// Requires an archive-capable `MAINNET_RPC_URL`. Without it the suite skips rather than fails, so
/// `forge test` stays green offline — but then it has proven nothing, which is why the skip is
/// logged loudly.
///
///   forge test --match-contract ForkLSTTest -vv
contract ForkLSTTest is Test {
    // Verified onchain this session via `cast call ... name()/symbol()`.
    address constant STETH = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address constant WSTETH = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address constant EETH = 0x35fA164735182de50811E8e2E824cFb9B6118ac2;
    address constant WEETH = 0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee;
    /// @dev Confirmed by reading `liquidityPool()` from BOTH weETH and eETH — they agree.
    address constant ETHERFI_POOL = 0x308861A430be4cce5502d0A12724771Fc6DaF216;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    uint256 constant PINNED_BLOCK = 25_623_153;

    /// @dev What Lido's dead Sepolia deployment reports, for contrast in the growth assertion.
    uint256 constant SEPOLIA_FROZEN_RATE = 1.037717825760305089e18;

    bool internal forkLive;

    MockIDRX internal idrx;
    MockAggregator internal feed;
    MockSwapRouter internal router;
    WstETHAdapter internal wstAdapter;
    WeETHAdapter internal weETHAdapter;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            console.log("SKIPPED: set MAINNET_RPC_URL to run fork tests against real Lido/ether.fi");
            return;
        }
        vm.createSelectFork(rpc, PINNED_BLOCK);
        forkLive = true;

        idrx = new MockIDRX(2);
        feed = new MockAggregator(8, "ETH / IDRX", int256(32_000_000) * 1e8);
        router = new MockSwapRouter(IERC20(address(idrx)), IERC20(WETH), IAggregatorV3(address(feed)));

        // Only the exit leg goes through the router; the staking legs are entirely real.
        router.setEthPegged(STETH, true);
        router.setEthPegged(EETH, true);
        deal(WETH, address(router), 10_000 ether);

        // This test contract stands in as the vault, so it may call the onlyVault entrypoints.
        wstAdapter = new WstETHAdapter(
            address(this), ISwapRouter(address(router)), IWETH(WETH), IStETH(STETH), IWstETH(WSTETH)
        );
        weETHAdapter = new WeETHAdapter(
            address(this),
            ISwapRouter(address(router)),
            IWETH(WETH),
            IEETH(EETH),
            IWeETH(WEETH),
            IEtherFiLiquidityPool(ETHERFI_POOL)
        );

        vm.deal(address(this), 1_000 ether);
    }

    modifier onlyFork() {
        if (!forkLive) return;
        _;
    }

    // =====================================================================

    function test_Fork_RealAddressesAreTheContractsWeThinkTheyAre() public onlyFork {
        assertEq(IERC20Metadataish(WSTETH).symbol(), "wstETH", "wstETH address");
        assertEq(IERC20Metadataish(STETH).symbol(), "stETH", "stETH address");
        assertEq(IERC20Metadataish(WEETH).symbol(), "weETH", "weETH address");
        assertEq(IERC20Metadataish(EETH).symbol(), "eETH", "eETH address");
        assertEq(IERC20Metadataish(WETH).symbol(), "WETH", "WETH address");
    }

    /// @notice Both venues have accrued real, substantial yield — the exact thing Lido's Sepolia
    ///         deployment can no longer demonstrate.
    function test_Fork_RatesHaveGenuinelyAccrued() public onlyFork {
        uint256 wstRate = IWstETH(WSTETH).stEthPerToken();
        uint256 weRate = IWeETH(WEETH).getRate();

        console.log("mainnet wstETH stEthPerToken :", wstRate);
        console.log("mainnet weETH  getRate       :", weRate);
        console.log("sepolia wstETH (frozen)      :", SEPOLIA_FROZEN_RATE);

        assertGt(wstRate, 1e18, "wstETH rate must be above par");
        assertGt(weRate, 1e18, "weETH rate must be above par");

        // Mainnet Lido has compounded well past the point Sepolia froze at.
        assertGt(wstRate, SEPOLIA_FROZEN_RATE, "mainnet has outgrown the frozen Sepolia rate");

        // The two venues are independent protocols and must not report an identical rate —
        // if they did, the basket would be diversified in name only.
        assertTrue(wstRate != weRate, "independent venues must price independently");
    }

    function test_Fork_WstETHAdapterStakesIntoRealLido() public onlyFork {
        uint256 stakeAmount = 10 ether;

        uint256 received = wstAdapter.deposit{value: stakeAmount}();

        assertGt(received, 0, "wstETH minted");
        assertEq(wstAdapter.lstBalance(), received, "adapter holds the wstETH");
        assertEq(IERC20(WSTETH).balanceOf(address(wstAdapter)), received, "real wstETH balance");

        // wstETH is worth more than ETH per unit, so fewer units than ETH staked.
        assertLt(received, stakeAmount, "wstETH trades above par against ETH");

        // Book value should come back to roughly what we put in, net of Lido's share rounding.
        assertApproxEqRel(wstAdapter.totalAssetsETH(), stakeAmount, 0.001e18, "book value round trips");
    }

    function test_Fork_WeETHAdapterStakesIntoRealEtherFi() public onlyFork {
        uint256 stakeAmount = 10 ether;

        uint256 received = weETHAdapter.deposit{value: stakeAmount}();

        assertGt(received, 0, "weETH minted");
        assertEq(weETHAdapter.lstBalance(), received, "adapter holds the weETH");
        assertEq(IERC20(WEETH).balanceOf(address(weETHAdapter)), received, "real weETH balance");
        assertLt(received, stakeAmount, "weETH trades above par against ETH");
        assertApproxEqRel(weETHAdapter.totalAssetsETH(), stakeAmount, 0.001e18, "book value round trips");
    }

    function test_Fork_WstETHAdapterUnwindsBackToEth() public onlyFork {
        wstAdapter.deposit{value: 10 ether}();

        uint256 lstHeld = wstAdapter.lstBalance();
        uint256 ethBefore = address(this).balance;

        // 1% slippage floor, as the vault would pass.
        uint256 expected = wstAdapter.totalAssetsETH();
        uint256 ethOut = wstAdapter.withdraw(lstHeld, (expected * 99) / 100);

        assertGt(ethOut, 0, "ETH returned");
        assertEq(address(this).balance - ethBefore, ethOut, "ETH actually reached the vault");
        assertEq(wstAdapter.lstBalance(), 0, "position fully unwound");
        assertApproxEqRel(ethOut, 10 ether, 0.01e18, "round trip within slippage");
    }

    function test_Fork_WeETHAdapterUnwindsBackToEth() public onlyFork {
        weETHAdapter.deposit{value: 10 ether}();

        uint256 lstHeld = weETHAdapter.lstBalance();
        uint256 ethBefore = address(this).balance;

        uint256 expected = weETHAdapter.totalAssetsETH();
        uint256 ethOut = weETHAdapter.withdraw(lstHeld, (expected * 99) / 100);

        assertGt(ethOut, 0, "ETH returned");
        assertEq(address(this).balance - ethBefore, ethOut, "ETH actually reached the vault");
        assertEq(weETHAdapter.lstBalance(), 0, "position fully unwound");
        assertApproxEqRel(ethOut, 10 ether, 0.01e18, "round trip within slippage");
    }

    /// @notice The slippage floor must actually bite against real protocol state, not just mocks.
    function test_Fork_RevertWhen_SlippageFloorCannotBeMet() public onlyFork {
        wstAdapter.deposit{value: 10 ether}();
        uint256 lstHeld = wstAdapter.lstBalance();

        // Demand more ETH back than the position is worth.
        vm.expectRevert();
        wstAdapter.withdraw(lstHeld, 100 ether);
    }

    function test_Fork_BasketSplitsAcrossTwoIndependentProtocols() public onlyFork {
        // 40/30 of a 10 ETH notional, as the vault's default weights would route it.
        wstAdapter.deposit{value: 4 ether}();
        weETHAdapter.deposit{value: 3 ether}();

        assertApproxEqRel(wstAdapter.totalAssetsETH(), 4 ether, 0.001e18, "Lido leg");
        assertApproxEqRel(weETHAdapter.totalAssetsETH(), 3 ether, 0.001e18, "ether.fi leg");

        // Genuinely different tokens from genuinely different issuers.
        assertTrue(wstAdapter.lst() != weETHAdapter.lst(), "distinct LSTs");
        assertEq(wstAdapter.lst(), WSTETH);
        assertEq(weETHAdapter.lst(), WEETH);
    }

    receive() external payable {}
}

interface IERC20Metadataish {
    function symbol() external view returns (string memory);
}
