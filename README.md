# SWR — Staking Wakaf Ritel

Retail cash-waqf on Ethereum. A wakif deposits IDRX and picks a tenor; the vault routes the deposit
across a basket of liquid-staking venues, strips the NAV surplus to a nadzir wallet, and returns
100% of the principal after tenor + unbonding.

Successor to [`WeissCurry/skripsi-staking`](https://github.com/WeissCurry/skripsi-staking). That
project shipped an ERC-4626 WETH vault where `period` and `poolId` were **decorative NFT metadata**
— nothing enforced them — and yield extraction was a manual `onlyOwner` call. Here the vault
actually enforces the tenor, runs an unbonding queue, and strips yield through a function anyone
can call.

> **Not as promises. As on-chain reality.**

---

## The honest risk, first

Principal is denominated in IDRX (rupiah) but backed by ETH-correlated assets. **If ETH falls
against the rupiah, NAV drops below principal and no amount of Solidity can conjure the
difference.**

What this codebase does is make that risk visible and survivable, not absent:

| Mechanism | What it does |
|---|---|
| `bufferBps` (default 10%) | No yield leaves until NAV exceeds principal **plus** a cushion |
| 30% idle IDRX sleeve | A stable leg that genuinely dampens ETH drawdown |
| `deficit` | Any shortfall at unstake is recorded onchain, never hidden |
| `solvencyRatioBps()` | Backing vs obligations, surfaced in the UI rather than styled away |
| `topUp()` | Permissionless — a takaful reserve, or anyone, can make wakif whole |

This is a property of the asset choice, not a bug to be fixed. It is stated in the UI before a user
signs. **Unaudited, testnet only, all tokens are play money.**

---

## Why Sepolia uses mocks

Verified onchain during development, not assumed:

| Check | Result |
|---|---|
| Lido Sepolia wstETH `stEthPerToken` | **1.0377, identical at head, −50k, −500k and −2.0M blocks** |
| `TokenRebased` events, 4 sampled windows | **zero** |
| Lido Sepolia WithdrawalQueue | **`isPaused: true`, `lastRequestId: 0`** |
| Lido's own docs | *"The Sepolia deployment is now fully **deprecated**."* |
| Mainnet wstETH `stEthPerToken` | 1.2402 and rising |
| Mainnet weETH `getRate` | 1.1001 and rising |

Lido's Sepolia deployment accepts deposits, never accrues yield, and cannot be exited. Wiring the
vault to it would produce a one-way trapdoor: no yield ever, and principal permanently stuck.

So the split is:

- **Sepolia** runs interface-identical mocks (`MockStETH`/`MockWstETH`, `MockEETH`/`MockWeETH`)
  that mirror the real ABIs exactly, including the share-based rebasing mechanics. The full
  lifecycle is demoable in minutes.
- **Mainnet fork tests** (`test/ForkLST.t.sol`) run the *same adapter code* against the real
  deployed Lido and ether.fi contracts. That is where the integration is actually proven.

---

## Architecture

```
SWRVault.sol ──┬── WstETHAdapter ──→ Lido      (submit → stETH → wrap → wstETH)
               ├── WeETHAdapter  ──→ ether.fi  (LiquidityPool → eETH → wrap → weETH)
               └── IkrarAkadNFT             (per-deposit akad certificate, onchain SVG)
```

The vault knows nothing about Lido or ether.fi — only `IYieldAdapter`. That is what lets a Sepolia
mock and a real mainnet integration be the same vault bytecode.

Four production contracts, one above the three-contract MVP guidance. The adapters are ~60-line
pass-throughs required by the two-venue basket; keeping them separate is what lets a real adapter
replace a mock without touching vault logic. A stated exception, not accidental over-building.

### Verified mainnet addresses

| Contract | Address |
|---|---|
| Lido stETH | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` |
| Lido wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| ether.fi eETH | `0x35fA164735182de50811E8e2E824cFb9B6118ac2` |
| ether.fi weETH | `0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee` |
| ether.fi LiquidityPool | `0x308861A430be4cce5502d0A12724771Fc6DaF216` |
| Sepolia WETH | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |
| Sepolia ETH/USD feed | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |

### Nothing is automatic

`harvest()` is permissionless and pays the caller a bounty out of the surplus it strips. There is no
cron, no scheduler, no privileged keeper — the flow diagram's "Keeper Node" is a convenience caller
competing with anyone else who wants the bounty.

| Function | Who calls it | Why | If nobody does |
|---|---|---|---|
| `deposit` | wakif | wants to give waqf | system idle, safe |
| `harvest` | **anyone** | earns the bounty | yield accrues in-vault, not lost |
| `requestUnstake` | wakif | starts their clock | funds stay staked, still theirs |
| `claim` | wakif | gets principal back | remains claimable indefinitely |

### Yield stripping

```
NAV       = idle IDRX + (wstETH + weETH value in ETH, priced through the oracle)
floor     = workingPrincipal + workingPrincipal × bufferBps / 10000
surplus   = NAV − floor
```

`workingPrincipal` excludes positions already unbonding — their backing has been pulled out and
earmarked, so counting them would freeze yield distribution the moment anyone starts unbonding.

The payout is sized from NAV **after** the unwind settles. Unwinding crosses two swap legs and is
not free; sizing from the pre-unwind NAV charges that cost to the buffer, and the vault ends a
harvest *below* its own floor — quietly funding the nadzir out of the wakif's cushion. Measuring
afterwards puts the cost on the yield, where it belongs.

---

## Repo layout

```
contracts/      Foundry — src/, test/, script/Deploy.s.sol, script/smoke.sh
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
forge test                                   # 65 tests
forge test --fuzz-runs 10000                 # deeper fuzzing
MAINNET_RPC_URL=<archive-rpc> forge test --match-contract ForkLSTTest -vv
```

Fork tests need an **archive-capable** mainnet RPC. Without `MAINNET_RPC_URL` they skip and log
that they did — a green suite without it has proven nothing about the real integration.

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
dips the vault below its floor, and the wakif gets their principal back.

### Deploy to Sepolia

```bash
cast wallet import tawf-deployer --interactive     # once; never a plaintext key
cp .env.example .env                                # fill in RPC + Etherscan key

cd contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $SEPOLIA_RPC_URL --account tawf-deployer --broadcast --verify

cd ../web && npm run abis && npm run build
```

The deploy script writes `web/src/generated/addresses.json`, so the frontend never hardcodes a
deployment.

Sepolia is seeded with **10 / 30 / 60-minute tenors and 5-minute unbonding** so the lifecycle is
demoable. A mainnet script would seed 30/90/180 days and 14 days — same code, different numbers.

---

## Testing

65 tests, four layers:

| Suite | What it covers |
|---|---|
| `SWRVault.t.sol` (39) | tenor lock, unbonding, non-transferable receipt, access control, oracle staleness, slippage floor, deficit path |
| `SWRVaultFuzz.t.sol` (11) | decimal normalisation, lifecycle round trip, harvest math, bounty bounds |
| `SWRVaultInvariant.t.sol` (7) | 8192 calls each — supply≡principal, reserved claims backed, solvency, yield never from principal |
| `ForkLST.t.sol` (8) | real mainnet Lido + ether.fi: stake 10 ETH into each, read live rates, unwind back |

IDRX is given **2 decimals** on purpose. Pairing a 2-decimal asset with 18-decimal ETH is a far
harsher exercise of the normalisation math than another 18-decimal token, and wrong-decimal
handling is the most common way money silently vanishes. **Verify the real IDRX decimals against
its live deployment before any mainnet use** — nothing here is authority on that.

Invariants assert **bounded truncation dust**, not exact equality. A rupiah figure converted to wei
and back sheds sub-unit remainders; asserting exact equality would be asserting something
arithmetically false. The bound still catches real leakage, which loses a *proportion* of value
rather than a couple of base units per call.

---

## Security

`forge test` clean, `slither` run and every finding triaged:

| Finding | Verdict |
|---|---|
| `reentrancy-eth` in `requestUnstake` | **Accepted.** `reservedForClaims` is written after liquidation because the reservable amount isn't knowable until the unwind returns — it cannot be hoisted. Mitigated by a shared `nonReentrant` lock across all entrypoints, and every address in the call path (router, adapters, WETH) is owner-configured, not caller-supplied. |
| `reentrancy-no-eth` in `deposit` | **Reduced.** Was the full position write; now only the cosmetic `akadTokenId`. `_safeMint` invokes `onERC721Received`, so principal, status and `totalPrincipal` are all committed before that callback can observe the vault. |
| `divide-before-multiply` in `_liquidateToIdrx` | **Accepted.** Inherent to proportional splitting across adapters; loss is bounded dust, covered by the invariant suite. |
| `incorrect-equality` (×13) | **False positive.** All are `if (x == 0) return` guard clauses, not balance-equality logic. |
| `weak-prng` in `_formatAmount` | **False positive.** `amount % scale` is decimal formatting, not randomness. |
| `unused-return` (×5) | **Deliberate.** Balance deltas are measured instead of trusting return values — more robust against share-rounding in Lido and ether.fi. |

Applied throughout: `SafeERC20`, CEI ordering, `nonReentrant`, custom errors, events on every state
change, no hardcoded `1e18`, oracle staleness + positivity checks, explicit non-zero `minAmountOut`
on every swap, exact-amount approvals (never `type(uint256).max`), no upgradeability.

---

## CROPS record

**Censorship resistance.** `harvest()` is permissionless; `claim()` has no pause and no owner gate,
so a wakif's exit never depends on this team. Verified by test: claiming works with a completely
dead oracle. The owner *can* set nadzir, weights, tenors and risk params — accepted for a thesis
MVP; move ownership to a Safe + timelock before real funds. Escape path: every entrypoint is
callable directly from Etherscan or abi.ninja without the frontend. The UI ships a user-configurable
RPC field so no single provider is load-bearing.

**Open source and free.** MIT. Whole stack public — contracts, frontend, deploy scripts, ABIs.
Fonts are self-hosted via `@fontsource` rather than pulled from Google, so the app makes no
third-party requests. Frontend builds with `base: "./"` so it works from IPFS or any subpath.

**Privacy.** Every deposit amount, tenor and wallet address is public, and the akad NFT renders the
wakif's address into a public SVG. The deposit card states this before a user signs, rather than
after.

**Security.** No proxy, no upgradeability — nothing to trust an admin not to change. The owner
cannot move principal, touch `reservedForClaims`, or block `claim()`. Tenor and unbonding period
are **snapshotted into each position**, so changing the config cannot extend a live lock (covered
by test). Residual risks: the USD/IDR oracle leg is owner-set on testnet and needs a real feed or
multi-source median in production, and the FX exposure described at the top.

---

## Known limitations

- **Unaudited.** No third-party review.
- **FX risk is real** and cannot be engineered away — see the top of this document.
- **Swap spread is a real cost.** Routing charges the DEX spread on the way in and out. Over a
  30-day tenor, yield may not cover a 0.6% round trip; over 180 days it comfortably does. The vault
  records any resulting shortfall as `deficit` rather than absorbing it silently.
- **Mock swap desk drains.** A full cycle pays WETH out twice and takes it back once. Anyone can
  refill via `router.fundWithEth()`.
- **IDRX decimals unverified** against the real token. Set to 2 here; confirm before mainnet.
- **The mock oracle is owner-priced.** Whoever sets it moves NAV, and therefore how much yield is
  strippable.

---

## License

MIT — see `LICENSE`. Every repo needed to run this app is under it, with no plan to relicense.
