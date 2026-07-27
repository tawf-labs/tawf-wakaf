// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
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

/// @notice Deploys the full SWR stack to Sepolia (or a local anvil).
///
/// Sepolia gets interface-identical MOCKS of Lido and ether.fi rather than the real deployments,
/// because Lido's Sepolia deployment is verifiably dead: the wstETH rate has been frozen for about
/// a year with zero rebase events, the withdrawal queue reports `isPaused: true`, and Lido's own
/// docs mark the deployment deprecated. Pointing at it would produce a vault that never earns and
/// never returns principal. The real integration is proven by `test/ForkLST.t.sol` against mainnet.
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $SEPOLIA_RPC_URL --account swr-deployer --broadcast --verify
contract Deploy is Script {
    uint256 constant SEPOLIA = 11155111;

    /// @dev Verified live onchain this session.
    address constant SEPOLIA_WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;

    uint8 constant IDRX_DECIMALS = 2;
    uint8 constant FEED_DECIMALS = 8;

    /// @dev ETH/IDR ~ Rp 32,000,000, from the live Sepolia ETH/USD feed (~$1963) x USD/IDR ~16,300.
    int256 constant INITIAL_ETH_IDRX = int256(32_000_000) * int256(10) ** FEED_DECIMALS;

    uint256 constant W_WSTETH = 4_000; // 40%
    uint256 constant W_WEETH = 3_000; // 30%, leaving 30% as the idle stable leg

    struct Deployment {
        address idrx;
        address weth;
        address feed;
        address router;
        address stETH;
        address wstETH;
        address eETH;
        address etherFiPool;
        address weETH;
        address akad;
        address vault;
        address wstAdapter;
        address weETHAdapter;
    }

    function run() external returns (Deployment memory d) {
        address deployer = msg.sender;
        address nadzir = vm.envOr("NADZIR_ADDRESS", deployer);
        uint256 routerEthSeed = vm.envOr("ROUTER_WETH_SEED", uint256(0.05 ether));

        // Short tenors so the whole lifecycle is demoable in minutes. A mainnet script would seed
        // 30/90/180 days and a 14-day unbonding — same code, different numbers.
        uint256[] memory tenors = new uint256[](3);
        tenors[0] = 10 minutes;
        tenors[1] = 30 minutes;
        tenors[2] = 1 hours;
        uint256 unbonding = 5 minutes;

        console.log("=== SWR deploy ===");
        console.log("chainid  :", block.chainid);
        console.log("deployer :", deployer);
        console.log("nadzir   :", nadzir);

        vm.startBroadcast();

        // --- assets --------------------------------------------------------
        MockIDRX idrx = new MockIDRX(IDRX_DECIMALS);

        address weth = block.chainid == SEPOLIA ? SEPOLIA_WETH : address(new MockWETH());

        MockAggregator feed = new MockAggregator(FEED_DECIMALS, "ETH / IDRX", INITIAL_ETH_IDRX);

        // --- staking venues (mocked, interface-identical to mainnet) --------
        MockStETH stETH = new MockStETH();
        MockWstETH wstETH = new MockWstETH(stETH);

        MockEETH eETH = new MockEETH();
        MockEtherFiLiquidityPool etherFiPool = new MockEtherFiLiquidityPool(eETH);
        eETH.setLiquidityPool(address(etherFiPool));
        MockWeETH weETH = new MockWeETH(eETH);

        // --- swap desk ------------------------------------------------------
        MockSwapRouter router =
            new MockSwapRouter(IERC20(address(idrx)), IERC20(weth), IAggregatorV3(address(feed)));
        router.setEthPegged(address(stETH), true);
        router.setEthPegged(address(eETH), true);

        // --- core -----------------------------------------------------------
        IkrarAkadNFT akad = new IkrarAkadNFT(IDRX_DECIMALS, "IDRX");

        SWRVault vault = new SWRVault(
            IERC20(address(idrx)),
            IWETH(weth),
            ISwapRouter(address(router)),
            IAggregatorV3(address(feed)),
            akad,
            nadzir,
            tenors,
            unbonding,
            deployer
        );

        akad.setVault(address(vault));

        WstETHAdapter wstAdapter = new WstETHAdapter(
            address(vault),
            ISwapRouter(address(router)),
            IWETH(weth),
            IStETH(address(stETH)),
            IWstETH(address(wstETH))
        );
        WeETHAdapter weETHAdapter = new WeETHAdapter(
            address(vault),
            ISwapRouter(address(router)),
            IWETH(weth),
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
        vault.setAdapters(adapters, weights);

        // The mock oracle has no node operators keeping it fresh, so allow a long window and rely
        // on the permissionless `poke()` for liveness. A real feed would use hours, not days.
        vault.setRiskParams(1_000, 50, 100, 7 days);

        // --- seed the swap desk ---------------------------------------------
        // A full deposit-then-exit cycle drains WETH inventory, so this is the practical cap on
        // demo volume. Anyone can refill via `router.fundWithEth()`.
        idrx.mint(address(router), 1_000_000_000_000 * (10 ** IDRX_DECIMALS));
        if (routerEthSeed > 0) {
            router.fundWithEth{value: routerEthSeed}();
        }

        vm.stopBroadcast();

        d = Deployment({
            idrx: address(idrx),
            weth: weth,
            feed: address(feed),
            router: address(router),
            stETH: address(stETH),
            wstETH: address(wstETH),
            eETH: address(eETH),
            etherFiPool: address(etherFiPool),
            weETH: address(weETH),
            akad: address(akad),
            vault: address(vault),
            wstAdapter: address(wstAdapter),
            weETHAdapter: address(weETHAdapter)
        });

        _report(d);
        _writeFrontendConfig(d);
    }

    function _report(Deployment memory d) internal pure {
        console.log("");
        console.log("--- addresses ---");
        console.log("SWRVault      :", d.vault);
        console.log("IkrarAkadNFT  :", d.akad);
        console.log("MockIDRX      :", d.idrx);
        console.log("WETH          :", d.weth);
        console.log("ETH/IDRX feed :", d.feed);
        console.log("SwapRouter    :", d.router);
        console.log("wstETHAdapter :", d.wstAdapter);
        console.log("weETHAdapter  :", d.weETHAdapter);
        console.log("stETH / wstETH:", d.stETH, d.wstETH);
        console.log("eETH  / weETH :", d.eETH, d.weETH);
        console.log("etherFiPool   :", d.etherFiPool);
    }

    /// @dev Emit the addresses the frontend needs, so `web/` never hardcodes a deployment.
    function _writeFrontendConfig(Deployment memory d) internal {
        string memory json = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(block.chainid), ",\n",
            '  "vault": "', vm.toString(d.vault), '",\n',
            '  "akad": "', vm.toString(d.akad), '",\n',
            '  "idrx": "', vm.toString(d.idrx), '",\n',
            '  "weth": "', vm.toString(d.weth), '",\n',
            '  "feed": "', vm.toString(d.feed), '",\n',
            '  "router": "', vm.toString(d.router), '",\n',
            '  "stETH": "', vm.toString(d.stETH), '",\n',
            '  "wstETH": "', vm.toString(d.wstETH), '",\n',
            '  "eETH": "', vm.toString(d.eETH), '",\n',
            '  "weETH": "', vm.toString(d.weETH), '",\n',
            '  "wstAdapter": "', vm.toString(d.wstAdapter), '",\n',
            '  "weETHAdapter": "', vm.toString(d.weETHAdapter), '"\n',
            "}\n"
        );
        vm.writeFile("../web/src/generated/addresses.json", json);
        console.log("");
        console.log("wrote web/src/generated/addresses.json");
    }
}
