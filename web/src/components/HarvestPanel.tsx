import { useAccount } from "wagmi";
import { Network, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { CONTRACTS } from "../lib/config";
import { MockAggregatorAbi, SWRVaultAbi } from "../generated/abis";
import { bpsToPercent, formatEth, formatRp } from "../lib/format";
import { useOnchainAction } from "../lib/useOnchainAction";
import { useAdapters, useVaultStats } from "../lib/useVault";
import { AddressChip, Button, Card, ErrorNote, Label, Stat, SuccessNote } from "./ui";

const vault = CONTRACTS.vault as `0x${string}`;
const feed = CONTRACTS.feed as `0x${string}`;

export function HarvestPanel() {
  const { isConnected } = useAccount();
  const stats = useVaultStats();
  const adapters = useAdapters(Number(stats.adapterCount ?? 0n));

  const harvest = useOnchainAction(() => stats.refetch());
  const poke = useOnchainAction(() => stats.refetch());

  const surplus =
    stats.nav !== undefined && stats.harvestFloor !== undefined && stats.nav > stats.harvestFloor
      ? stats.nav - stats.harvestFloor
      : 0n;

  const solvent = (stats.solvencyBps ?? 0n) >= 10_000n;
  const hasDeficit = (stats.deficit ?? 0n) > 0n;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Yield Stripping</Label>
          <h3 className="mt-2 font-serif text-2xl">Harvest yield for Nazir</h3>
        </div>
        <Sparkles className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <p className="mt-3 text-tawf-muted">
        This function is open to anyone — no admin, no privileged keeper. The caller
        receives a bounty of {bpsToPercent(stats.harvestBountyBps)} from the harvested surplus,
        the remainder goes directly to the Nazir's wallet.
      </p>

      {stats.oracleStale && (
        <ErrorNote message="Oracle price is stale, so NAV cannot be calculated. Refresh the oracle below to continue." />
      )}

      {/* NAV breakdown */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <Stat label="Portfolio NAV" value={formatRp(stats.nav, stats.decimals)} />
        <Stat
          label="Harvest Floor"
          value={formatRp(stats.harvestFloor, stats.decimals)}
          hint={`principal + buffer ${bpsToPercent(stats.bufferBps)}`}
        />
        <Stat
          label="Available Surplus"
          value={formatRp(surplus, stats.decimals)}
          tone={surplus > 0n ? "good" : "default"}
          hint={surplus > 0n ? "ready for distribution" : "has not exceeded buffer"}
        />
        <Stat
          label="Solvency Ratio"
          value={bpsToPercent(stats.solvencyBps)}
          tone={solvent ? "good" : "warn"}
          hint={solvent ? "principal fully guaranteed" : "below par — see risk notes"}
        />
      </div>

      {hasDeficit && (
        <ErrorNote
          message={`Recorded deficit ${formatRp(
            stats.deficit,
            stats.decimals,
          )}. This appears when staking asset value drops against rupiah — exchange rate risk that code cannot eliminate. Anyone can cover it via topUp().`}
        />
      )}

      <div className="mt-8 space-y-3">
        <Button
          className="w-full"
          disabled={!isConnected || surplus === 0n}
          busy={harvest.busy}
          busyLabel={harvest.isConfirming ? "Waiting for confirmation…" : "Harvesting…"}
          onClick={() =>
            harvest.execute({ address: vault, abi: SWRVaultAbi, functionName: "harvest" })
          }
        >
          <TrendingUp className="h-4 w-4" aria-hidden />
          Harvest &amp; Distribute to Nazir
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          disabled={!isConnected}
          busy={poke.busy}
          busyLabel="Refreshing…"
          onClick={() =>
            poke.execute({ address: feed, abi: MockAggregatorAbi, functionName: "poke" })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh Oracle
        </Button>
      </div>

      {harvest.error && <ErrorNote message={harvest.error} onDismiss={harvest.clearError} />}
      {poke.error && <ErrorNote message={poke.error} onDismiss={poke.clearError} />}
      {harvest.justSucceeded && <SuccessNote>Proceeds successfully distributed to the Nazir.</SuccessNote>}

      {/* Basket breakdown */}
      <div className="mt-8 border-t border-tawf-green/10 pt-6">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-tawf-gold" aria-hidden />
          <span className="label-caps">Portfolio Diversification</span>
        </div>

        <div className="mt-4 space-y-3">
          {adapters.map((a, i) =>
            a ? (
              <div key={i} className="flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="text-tawf-ink">{a[1]}</p>
                  <AddressChip address={a[0]} />
                </div>
                <div className="text-right">
                  <p className="tnum text-tawf-ink">{formatRp(a[4], stats.decimals)}</p>
                  <p className="tnum text-xs text-tawf-muted">
                    {Number(a[2]) / 100}% target · {formatEth(a[3])}
                  </p>
                </div>
              </div>
            ) : null,
          )}

          <div className="flex items-center justify-between gap-4 border-t border-tawf-green/10 pt-3 text-sm">
            <div>
              <p className="text-tawf-ink">IDRX stable reserve</p>
              <p className="text-xs text-tawf-muted">
                substitutes for shariah RWA sleeve, and the first cushion when the market falls
              </p>
            </div>
            <p className="tnum shrink-0 text-tawf-muted">30% target</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
