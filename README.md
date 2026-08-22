# SWR, Retail Cash Waqf

Retail cash-waqf on Ethereum. A waqif deposits USDC under one of two akad; the vault routes the
deposit across a basket of liquid-staking venues and strips the NAV surplus to a nazir wallet.

| Akad | Corpus | Contract behaviour |
|---|---|---|
| **Waqf mu'abbad**, perpetual | never returned | `depositPerpetual()`; `requestUnstake` reverts `PerpetualPosition()` forever |
| **Waqf mu'aqqat**, fixed tenor | returned 100% after tenor + unbonding | `deposit()`, then `requestUnstake` → `claim` |

The perpetual akad is enforced in Solidity, not in the UI. There is no function, for the waqif,
the nazir, or the owner, that returns a perpetual corpus. Hiding a button would have repeated
exactly the flaw this project was written to correct.

Successor to [`WeissCurry/skripsi-staking`](https://github.com/WeissCurry/skripsi-staking). That
project shipped an ERC-4626 WETH vault where `period` and `poolId` were **decorative NFT metadata**
that nothing enforced, and yield extraction was a manual `onlyOwner` call. Here the vault
actually enforces the tenor, runs an unbonding queue, and strips yield through a function anyone
can call.

> **Not as promises. As on-chain reality.**

---

## The honest risk, first

Principal is denominated in USDC (dollars) but backed by ETH-correlated assets. **If ETH falls
against the dollar, NAV drops below principal and no amount of Solidity can conjure the
difference.**

What this codebase does is make that risk visible and survivable, not absent:

| Mechanism | What it does |
|---|---|
| `bufferBps` (default 10%) | No yield leaves until NAV exceeds principal **plus** a cushion |
| 30% idle USDC sleeve | A stable leg that genuinely dampens ETH drawdown |
| `deficit` | Any shortfall at unstake is recorded onchain, never hidden |
| `solvencyRatioBps()` | Backing vs obligations, surfaced in the UI rather than styled away |
| `topUp()` | Permissionless. A takaful reserve, or anyone, can make waqif whole |

This is a property of the asset choice, not a bug to be fixed. It is stated in the UI before a user
signs. **Unaudited, testnet only, all tokens are play money.**

---

## Why the staking venues are mocks (and what is real)

The deposit asset and the oracle are **real** on Arbitrum Sepolia; the staking venues are mocked
because neither Lido nor ether.fi has a usable Arbitrum Sepolia deployment.

| Check | Result |
|---|---|
| Arbitrum Sepolia USDC | **real Circle USDC**, `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`, 6 decimals (verified) |
| Arbitrum Sepolia ETH/USD feed | **real Chainlink**, `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165`, 8 decimals (verified, live) |
| Arbitrum Sepolia WETH | **real canonical wrapper**, `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` (verified) |
| Lido Sepolia wstETH `stEthPerToken` | 1.0377, identical at head, −50k, −500k and −2.0M blocks |
| Lido Sepolia WithdrawalQueue | `isPaused: true`, `lastRequestId: 0` — fully **deprecated** |
| Mainnet wstETH `stEthPerToken` | 1.2402 and rising |
| Mainnet weETH `getRate` | 1.1001 and rising |

So the split is:

- **Arbitrum Sepolia** runs the real USDC, the real Chainlink ETH/USD feed and the real WETH, plus
  interface-identical mocks for the LST venues (`MockStETH`/`MockWstETH`, `MockEETH`/`MockWeETH`)
  and the swap desk (`MockSwapRouter`), because the real protocols have no deployment there to point
  at. Deposit, harvest and the tenor lock are all demoable against the live contracts; the swap desk
  is a pre-funded inventory desk, not an AMM.
- **Mainnet fork tests** (`test/ForkLST.t.sol`) run the *same adapter code* against the real
  deployed Lido and ether.fi contracts. That is where the real LST integration is actually proven.

---

## Architecture

```
SWRVault.sol ──┬── WstETHAdapter ──→ Lido      (submit → stETH → wrap → wstETH)
               ├── WeETHAdapter  ──→ ether.fi  (LiquidityPool → eETH → wrap → weETH)
               └── AkadCertificateNFT             (per-deposit akad certificate, onchain SVG)
```

The vault knows nothing about Lido or ether.fi, only `IYieldAdapter`. That is what lets a Sepolia
mock and a real mainnet integration be the same vault bytecode.

Four production contracts, one above the three-contract MVP guidance. The adapters are ~60-line
pass-throughs required by the two-venue basket; keeping them separate is what lets a real adapter
replace a mock without touching vault logic. A stated exception, not accidental over-building.

### Verified addresses

External contracts verified onchain (`cast code` + `decimals()`/`symbol()`), not assumed:

| Contract | Address |
|---|---|
| **Arbitrum Sepolia USDC** (Circle, 6 decimals) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| **Arbitrum Sepolia ETH/USD feed** (Chainlink, 8 decimals) | `0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165` |
| **Arbitrum Sepolia WETH** (canonical, 18 decimals) | `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73` |
| Lido stETH (mainnet) | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` |
| Lido wstETH (mainnet) | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| ether.fi eETH (mainnet) | `0x35fA164735182de50811E8e2E824cFb9B6118ac2` |
| ether.fi weETH (mainnet) | `0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee` |
| ether.fi LiquidityPool (mainnet) | `0x308861A430be4cce5502d0A12724771Fc6DaF216` |

The deployed Tawf contracts (vault, akad NFT, adapters, mock swap desk) are written by
`script/Deploy.s.sol` into `web/src/generated/addresses.json` — never hardcoded in prose.

### Nothing is automatic

`harvest()` is permissionless and pays the caller a bounty out of the surplus it strips. There is no
cron, no scheduler, no privileged keeper. The flow diagram's "Keeper Node" is a convenience caller
competing with anyone else who wants the bounty.

| Function | Who calls it | Why | If nobody does |
|---|---|---|---|
| `deposit` | waqif | wants to give waqf | system idle, safe |
| `harvest` | **anyone** | earns the bounty | yield accrues in-vault, not lost |
| `requestUnstake` | waqif | starts their clock | funds stay staked, still theirs |
| `claim` | waqif | gets principal back | remains claimable indefinitely |

### Yield stripping

```
NAV       = idle USDC + (wstETH + weETH value in ETH, priced through the ETH/USD oracle)
floor     = workingPrincipal + workingPrincipal × bufferBps / 10000
surplus   = NAV − floor
```

`workingPrincipal` excludes positions already unbonding, because their backing has been pulled out and
earmarked, so counting them would freeze yield distribution the moment anyone starts unbonding.

The payout is sized from NAV **after** the unwind settles. Unwinding crosses two swap legs and is
not free; sizing from the pre-unwind NAV charges that cost to the buffer, and the vault ends a
harvest *below* its own floor, quietly funding the nazir out of the waqif's cushion. Measuring
afterwards puts the cost on the yield, where it belongs.

---

## Repo layout

```
contracts/      Foundry: src/, test/, script/Deploy.s.sol, script/smoke.sh
web/            React 19 + Vite 6 + Tailwind v4 + wagmi/viem/RainbowKit
design_guidelines.md   Tawf Islamic Foundation design system (authoritative for web/)
prd.md          Original product brief
```

---

## Running it

### Contracts

```bash
cd contracts
forge build
forge test                                   # 82 tests
forge test --fuzz-runs 10000                 # deeper fuzzing
MAINNET_RPC_URL=<archive-rpc> forge test --match-contract ForkLSTTest -vv
```

Fork tests need an **archive-capable** mainnet RPC. Without `MAINNET_RPC_URL` they skip and log
that they did. A green suite without it has proven nothing about the real integration.

### Local end-to-end

```bash
anvil                                        # terminal 1

cd contracts                                 # terminal 2
forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
./script/smoke.sh http://127.0.0.1:8545 \
  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

cd web && npm install && npm run abis && npm run dev
```

`smoke.sh` walks the whole lifecycle and asserts the two properties that matter: a harvest never
dips the vault below its floor, and the waqif gets their principal back.

### Deploy to Arbitrum Sepolia

```bash
cast wallet import tawf-deployer --interactive     # once; never a plaintext key
cp .env.example .env                                # fill in RPC + Etherscan/Arbiscan key

cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --account tawf-deployer \
  --sender $(cast wallet address --account tawf-deployer) --broadcast

cd ../web && npm run abis && npm run build
```

The deploy script branches on chain id: on Arbitrum Sepolia it wires the **real Circle USDC, the
real Chainlink ETH/USD feed and the real WETH**, and skips USDC minting (there is none — USDC is
real). The mock swap desk still needs USDC inventory, so after the broadcast the deployer seeds it:

```bash
cast send $USDC "transfer(address,uint256)" $ROUTER 10000000000 --rpc-url $ARBITRUM_SEPOLIA_RPC_URL --account tawf-deployer
```

The deploy script writes `web/src/generated/addresses.json`, so the frontend never hardcodes a
deployment.

Arbitrum Sepolia is seeded with **30 / 90 / 180-day tenors and 14-day unbonding**, the same ladder a
mainnet script would use. It was once 10 / 30 / 60 minutes so a demo could sit through a maturity,
which made the picker read as a lockup rather than an endowment. Maturity is proven instead by the
test suite and by `smoke.sh` on anvil, both of which warp time. On Arbitrum Sepolia the lock is shown
by depositing and calling `requestUnstake` immediately, which reverts `TenorNotElapsed`.

---

## Testing

82 tests, four layers:

| Suite | What it covers |
|---|---|
| `SWRVault.t.sol` (39) | tenor lock, unbonding, non-transferable receipt, access control, oracle staleness, slippage floor, deficit path |
| `SWRVaultFuzz.t.sol` (11) | decimal normalisation, lifecycle round trip, harvest math, bounty bounds |
| `SWRVaultInvariant.t.sol` (7) | 8192 calls each: supply≡principal, reserved claims backed, solvency, yield never from principal |
| `ForkLST.t.sol` (8) | real mainnet Lido + ether.fi: stake 10 ETH into each, read live rates, unwind back |

USDC is given its real **6 decimals** on purpose. Pairing a 6-decimal asset with 18-decimal ETH is
a harsher exercise of the normalisation math than another 18-decimal token, and wrong-decimal
handling is the most common way money silently vanishes. The vault reads `decimals()` from the
token rather than hardcoding it, and the Arbitrum Sepolia deploy points at Circle's live USDC.

Invariants assert **bounded truncation dust**, not exact equality. A dollar figure converted to wei
and back sheds sub-unit remainders; asserting exact equality would be asserting something
arithmetically false. The bound still catches real leakage, which loses a *proportion* of value
rather than a couple of base units per call.

---

## Security

`forge test` clean, `slither` run and every finding triaged:

| Finding | Verdict |
|---|---|
| `reentrancy-eth` in `requestUnstake` | **Accepted.** `reservedForClaims` is written after liquidation because the reservable amount isn't knowable until the unwind returns, so it cannot be hoisted. Mitigated by a shared `nonReentrant` lock across all entrypoints, and every address in the call path (router, adapters, WETH) is owner-configured, not caller-supplied. |
| `reentrancy-no-eth` in `deposit` | **Reduced.** Was the full position write; now only the cosmetic `akadTokenId`. `_safeMint` invokes `onERC721Received`, so principal, status and `totalPrincipal` are all committed before that callback can observe the vault. |
| `divide-before-multiply` in `_liquidateToUsdc` | **Accepted.** Inherent to proportional splitting across adapters; loss is bounded dust, covered by the invariant suite. |
| `incorrect-equality` (×13) | **False positive.** All are `if (x == 0) return` guard clauses, not balance-equality logic. |
| `weak-prng` in `_formatAmount` | **False positive.** `amount % scale` is decimal formatting, not randomness. |
| `unused-return` (×5) | **Deliberate.** Balance deltas are measured instead of trusting return values, which is more robust against share-rounding in Lido and ether.fi. |

Applied throughout: `SafeERC20`, CEI ordering, `nonReentrant`, custom errors, events on every state
change, no hardcoded `1e18`, oracle staleness + positivity checks, explicit non-zero `minAmountOut`
on every swap, exact-amount approvals (never `type(uint256).max`), no upgradeability.

---

## CROPS record

**Censorship resistance.** `harvest()` is permissionless; `claim()` has no pause and no owner gate,
so a waqif's exit never depends on this team. Verified by test: claiming works with a completely
dead oracle. The owner *can* set nazir, weights, tenors and risk params, accepted for a thesis
MVP; move ownership to a Safe + timelock before real funds. Escape path: every entrypoint is
callable directly from Etherscan or abi.ninja without the frontend. The UI ships a user-configurable
RPC field so no single provider is load-bearing.

**Open source and free.** MIT. Whole stack public: contracts, frontend, deploy scripts, ABIs.
Fonts are self-hosted via `@fontsource` rather than pulled from Google, so the app makes no
third-party requests. Frontend builds with `base: "./"` so it works from IPFS or any subpath.

**Privacy.** Every deposit amount, tenor and wallet address is public, and the akad NFT renders the
waqif's address into a public SVG. The deposit card states this before a user signs, rather than
after. Reads go through the default provider unless you point the app at your own node, which is
a console setting rather than a panel in the header:

```js
localStorage.setItem("swr.rpcUrl", "https://your-node");  // then reload
```

**Security.** No proxy, no upgradeability, so there is nothing to trust an admin not to change. The owner
cannot move principal, touch `reservedForClaims`, or block `claim()`. Tenor and unbonding period
are **snapshotted into each position**, so changing the config cannot extend a live lock (covered
by test). On Arbitrum Sepolia the vault reads Chainlink's live ETH/USD feed (stale-after 24h), so
NAV no longer depends on an owner-priced oracle. Residual risks: the yield venues are still mock
adapters (real Lido/ether.fi adapters exist but are unproven against the real tokens on L2), and
the swap desk is a mock that must be kept funded with real USDC and WETH.

---

## Known limitations

- **Unaudited.** No third-party review.
- **USDC is the denomination**, so there is no IDR/FX leg to model — but USDC itself carries
  counterparty risk to Circle and its reserve composition. See the top of this document.
- **Swap spread is a real cost.** Routing charges the DEX spread on the way in and out. Over a
  30-day tenor, yield may not cover a 0.6% round trip; over 180 days it comfortably does. The vault
  records any resulting shortfall as `deficit` rather than absorbing it silently.
- **The staking venues are mocks.** `WstETHAdapter`/`WeETHAdapter` are real and deployed against
  mainnet Lido/ether.fi, but on Arbitrum Sepolia the vault is wired to mock rebasing LSTs so the
  end-to-end flow runs without mainnet bridges. Real yield is not generated on the testnet.
- **The mock swap desk must stay funded.** A full cycle pays WETH out twice and takes it back once;
  the router also needs real USDC for the stablecoin legs. Anyone can refill ETH via
  `router.fundWithEth()`; USDC must be transferred in by a holder.

---

## License

MIT, see `LICENSE`. Every repo needed to run this app is under it, with no plan to relicense.
