// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {SWRVault} from "../src/SWRVault.sol";
import {AkadCertificateNFT} from "../src/AkadCertificateNFT.sol";
import {WstETHAdapter} from "../src/adapters/WstETHAdapter.sol";
import {WeETHAdapter} from "../src/adapters/WeETHAdapter.sol";
import {IYieldAdapter} from "../src/interfaces/IYieldAdapter.sol";
import {ISwapRouter, IWETH} from "../src/interfaces/ISwapRouter.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";
import {IStETH, IWstETH, IEETH, IWeETH, IEtherFiLiquidityPool} from "../src/interfaces/ILST.sol";

import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockWETH} from "../src/mocks/MockWETH.sol";
import {MockAggregator} from "../src/mocks/MockAggregator.sol";
import {MockStETH} from "../src/mocks/MockStETH.sol";
import {MockEETH, MockEtherFiLiquidityPool} from "../src/mocks/MockEETH.sol";
import {MockWstETH, MockWeETH} from "../src/mocks/MockWrappedLST.sol";
import {MockSwapRouter} from "../src/mocks/MockSwapRouter.sol";

/// @notice Deploys the full SWR stack, either to Arbitrum Sepolia (real USDC) or to a local anvil.
///
/// ## Arbitrum Sepolia — real USDC, real oracle
///
/// The deposit asset is the REAL Circle USDC (verified: symbol `USDC`, 6 decimals), the NAV oracle
/// is the REAL Chainlink ETH/USD feed (verified), and WETH is the canonical Arbitrum Sepolia
/// wrapper. The staking venues (Lido/ether.fi) and the swap desk remain interface-identical mocks,
/// because neither protocol has a usable Arbitrum Sepolia deployment to point at. The real
/// integration is proven by `test/ForkLST.t.sol` against mainnet.
///
/// USDC cannot be minted, so the swap desk's USDC inventory is NOT seeded here — top it up after
/// deploy by transferring USDC to the router (see README). WETH inventory is seeded from the
/// deployer's ETH.
///
/// ## anvil / Ethereum Sepolia — mock USDC, mock oracle
///
/// Uses `MockUSDC` (open faucet) and `MockAggregator` (owner-priced ETH/USD) so the full lifecycle
/// is demoable locally, where time can be warped.
///
/// Usage (Arbitrum Sepolia):
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --account tawf-deployer \
///     --sender $(cast wallet address --account tawf-deployer) --broadcast
///
/// `--sender` MUST equal the account address: `msg.sender` inside the script otherwise stays at
/// Foundry's default `0x1804c8AB…` while the broadcast is signed by the keystore, and the vault
/// end up owned by a phantom address (`OwnableUnauthorizedAccount` on `setAdapters`).
contract Deploy is Script {
    uint256 constant SEPOLIA = 11155111;
    uint256 constant ARBITRUM_SEPOLIA = 421614;

    /// @dev Verified live onchain this session.
    address constant SEPOLIA_WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    address constant ARBITRUM_SEPOLIA_WETH = 0x980B62Da83eFf3D4576C647993b0c1D7faf17c73;
    address constant ARBITRUM_SEPOLIA_USDC = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d;
    address constant ARBITRUM_SEPOLIA_ETH_USD_FEED = 0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165;

    uint8 constant USDC_DECIMALS = 6;
    uint8 constant FEED_DECIMALS = 8;

    /// @dev ~$2,400, a plausible ETH/USD for the anvil/Sepolia mock. Arbitrum Sepolia ignores this
    ///      and reads the live Chainlink feed instead.
    int256 constant INITIAL_ETH_USD = int256(2_400) * int256(10) ** FEED_DECIMALS;

    uint256 constant W_WSTETH = 4_000; // 40%
    uint256 constant W_WEETH = 3_000; // 30%, leaving 30% as the idle stable leg

    struct Deployment {
        address usdc;
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
        address nazir = vm.envOr("NAZIR_ADDRESS", deployer);
        uint256 routerEthSeed = vm.envOr("ROUTER_WETH_SEED", uint256(0.05 ether));
        bool isArb = block.chainid == ARBITRUM_SEPOLIA;

        // Real waqf mu'aqqat terms, the same ones a mainnet script would seed. The maturity path is
        // covered by the test suite and by smoke.sh on anvil, both of which warp time, so a public
        // testnet does not need a tenor short enough to wait out.
        uint256[] memory tenors = new uint256[](3);
        tenors[0] = 30 days;
        tenors[1] = 90 days;
        tenors[2] = 180 days;
        uint256 unbonding = 14 days;

        console.log("=== SWR deploy ===");
        console.log("chainid  :", block.chainid);
        console.log("mode     :", isArb ? "Arbitrum Sepolia (real USDC)" : "local/mock USDC");
        console.log("deployer :", deployer);
        console.log("nazir   :", nazir);

        vm.startBroadcast();

        // --- deposit asset + oracle -----------------------------------------
        IERC20 usdc = isArb
            ? IERC20(ARBITRUM_SEPOLIA_USDC)
            : IERC20(address(new MockUSDC(USDC_DECIMALS)));
        uint8 assetDecimals = IERC20Metadata(address(usdc)).decimals();

        address weth = isArb
            ? ARBITRUM_SEPOLIA_WETH
            : (block.chainid == SEPOLIA ? SEPOLIA_WETH : address(new MockWETH()));

        IAggregatorV3 feed = isArb
            ? IAggregatorV3(ARBITRUM_SEPOLIA_ETH_USD_FEED)
            : IAggregatorV3(address(new MockAggregator(FEED_DECIMALS, "ETH / USD", INITIAL_ETH_USD)));

        // --- staking venues (mocked, interface-identical to mainnet) --------
        MockStETH stETH = new MockStETH();
        MockWstETH wstETH = new MockWstETH(stETH);

        MockEETH eETH = new MockEETH();
        MockEtherFiLiquidityPool etherFiPool = new MockEtherFiLiquidityPool(eETH);
        eETH.setLiquidityPool(address(etherFiPool));
        MockWeETH weETH = new MockWeETH(eETH);

        // --- swap desk ------------------------------------------------------
        MockSwapRouter router = new MockSwapRouter(usdc, IERC20(weth), feed);
        router.setEthPegged(address(stETH), true);
        router.setEthPegged(address(eETH), true);

        // --- core -----------------------------------------------------------
        AkadCertificateNFT akad = new AkadCertificateNFT(assetDecimals, "USDC");

        SWRVault vault = new SWRVault(
            usdc,
            IWETH(weth),
            ISwapRouter(address(router)),
            feed,
            akad,
            nazir,
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

        // A live Chainlink feed is kept fresh by its own node operators, so a few hours is plenty
        // of headroom. The mock feed has nobody to keep it alive, so allow a long window.
        vault.setRiskParams(1_000, 50, 100, isArb ? 24 hours : 7 days);

        // --- seed the swap desk ---------------------------------------------
        // On anvil/Sepolia the mock token can be minted. On Arbitrum Sepolia the real USDC cannot,
        // so its inventory is topped up after deploy by transferring USDC to the router (README).
        if (!isArb) {
            MockUSDC(address(usdc)).mint(address(router), 1_000_000_000_000 * (10 ** USDC_DECIMALS));
        }
        if (routerEthSeed > 0) {
            router.fundWithEth{value: routerEthSeed}();
        }

        vm.stopBroadcast();

        d = Deployment({
            usdc: address(usdc),
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
        console.log("AkadCertificateNFT  :", d.akad);
        console.log("USDC          :", d.usdc);
        console.log("WETH          :", d.weth);
        console.log("ETH/USD feed  :", d.feed);
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
            '  "usdc": "', vm.toString(d.usdc), '",\n',
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
