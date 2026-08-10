import { useState } from "react";
import { useAccount } from "wagmi";
import { FlaskConical, RefreshCw, TrendingUp } from "lucide-react";
import { CONTRACTS } from "../lib/config";
import { MockAggregatorAbi, MockRebasingLSTAbi } from "../generated/abis";
import { useOnchainAction } from "../lib/useOnchainAction";
import { useVaultStats } from "../lib/useVault";
import { Button, Card, ErrorNote, Label, SuccessNote } from "./ui";

const stETH = CONTRACTS.stETH as `0x${string}`;
const eETH = CONTRACTS.eETH as `0x${string}`;
const feed = CONTRACTS.feed as `0x${string}`;

const STEPS = [100, 250, 500] as const;

/// Testnet-only controls.
///
/// On a real network validator rewards arrive on their own and the vault simply observes them.
/// The Sepolia deployment uses interface-identical mocks — Lido's own Sepolia deployment is
/// deprecated, its rate frozen and its withdrawal queue paused — so nothing ever accrues unless
/// somebody says so. Without this panel `harvest()` can never have a surplus to strip and the
/// yield-stripping half of the protocol is undemonstrable.
///
/// `accrueBps` is permissionless in the mock by design: it is faucet-grade, and gating it behind
/// an owner key would put an admin on the critical path of a demo that exists to show there
/// isn't one.
export function TestnetLab() {
  const { isConnected } = useAccount();
  const stats = useVaultStats();
  const [bps, setBps] = useState<number>(500);

  const accrue = useOnchainAction(() => stats.refetch());
  const poke = useOnchainAction(() => stats.refetch());

  // Growing a pool of zero yields zero, and the mock reverts on a zero reward. Nothing is staked
  // until the first deposit routes ETH through the adapters.
  const nothingStaked = (stats.adapterEth ?? 0n) === 0n;

  return (
    <Card sand>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Testnet Laboratory</Label>
          <h3 className="mt-2 font-serif text-2xl">Simulate validator rewards</h3>
        </div>
        <FlaskConical className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <p className="mt-3 text-tawf-muted">
        On mainnet, staking rewards land by themselves. This deployment stakes into
        interface-identical mocks of Lido and ether.fi, so growth has to be triggered by hand.
        Raising the rate here is what gives <code className="text-tawf-green">harvest()</code> a
        surplus to strip.
      </p>

      <div className="mt-8">
        <span className="label-caps">Reward Size</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {STEPS.map((s) => (
            <button
              key={s}
              onClick={() => setBps(s)}
              aria-pressed={bps === s}
              className={`rounded-2xl border px-3 py-3 text-sm transition-colors ${
                bps === s
                  ? "border-tawf-green bg-tawf-green text-tawf-sand"
                  : "border-tawf-green/15 bg-white text-tawf-ink hover:border-tawf-green/40"
              }`}
              style={{ minHeight: 44 }}
            >
              +{s / 100}%
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Button
          className="w-full"
          disabled={!isConnected || nothingStaked}
          busy={accrue.busy}
          busyLabel={accrue.isConfirming ? "Waiting for confirmation…" : "Accruing…"}
          onClick={() =>
            // Both legs of the basket grow together, so the 40/30 split stays proportional and
            // the demo does not silently drift into a single-asset portfolio.
            accrue.executeMany([
              {
                address: stETH,
                abi: MockRebasingLSTAbi,
                functionName: "accrueBps",
                args: [BigInt(bps)],
              },
              {
                address: eETH,
                abi: MockRebasingLSTAbi,
                functionName: "accrueBps",
                args: [BigInt(bps)],
              },
            ])
          }
        >
          <TrendingUp className="h-4 w-4" aria-hidden />
          Accrue +{bps / 100}% on both LSTs
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          disabled={!isConnected}
          busy={poke.busy}
          busyLabel="Refreshing…"
          onClick={() => poke.execute({ address: feed, abi: MockAggregatorAbi, functionName: "poke" })}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh Oracle Timestamp
        </Button>
      </div>

      {nothingStaked && (
        <p className="mt-4 text-sm text-tawf-muted">
          Nothing is staked yet — make a waqf deposit first, then rewards have a balance to grow.
        </p>
      )}

      {accrue.error && <ErrorNote message={accrue.error} onDismiss={accrue.clearError} />}
      {poke.error && <ErrorNote message={poke.error} onDismiss={poke.clearError} />}
      {accrue.justSucceeded && (
        <SuccessNote>
          Rewards accrued. NAV should now be climbing above the harvest floor.
        </SuccessNote>
      )}
      {poke.justSucceeded && <SuccessNote>Oracle timestamp refreshed.</SuccessNote>}

      <p className="mt-6 border-t border-tawf-green/10 pt-4 text-xs text-tawf-muted">
        These contracts are testnet mocks and are never deployed to mainnet. The real Lido and
        ether.fi integration is proven by fork tests against mainnet, not by this panel.
      </p>
    </Card>
  );
}
