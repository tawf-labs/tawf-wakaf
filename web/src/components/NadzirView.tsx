import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { HeartHandshake, Landmark } from "lucide-react";
import type { Log } from "viem";
import { CONTRACTS } from "../lib/config";
import { SWRVaultAbi } from "../generated/abis";
import { formatRp } from "../lib/format";
import { useVaultStats } from "../lib/useVault";
import { AddressChip, Card, Label, Stat } from "./ui";

const vault = CONTRACTS.vault as `0x${string}`;

type HarvestRecord = { block: bigint; toNadzir: bigint; bounty: bigint; caller: string };

/// Read-only ledger of everything the nadzir has received, reconstructed from `YieldStripped`
/// events.
///
/// Events are the primary way to read onchain history — contract storage only ever holds the
/// running total, not how it got there. Reading them straight from an RPC rather than through an
/// indexer keeps the page working with no backend to trust or keep alive.
export function NadzirView() {
  const stats = useVaultStats();
  const client = usePublicClient();
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      try {
        const latest = await client.getBlockNumber();
        // Public RPCs cap `eth_getLogs` ranges, so stay inside a window they will serve.
        const fromBlock = latest > 45_000n ? latest - 45_000n : 0n;

        const logs = await client.getContractEvents({
          address: vault,
          abi: SWRVaultAbi,
          eventName: "YieldStripped",
          fromBlock,
          toBlock: latest,
        });

        if (cancelled) return;
        setRecords(
          logs
            .map((l: Log & { args?: Record<string, unknown> }) => ({
              block: l.blockNumber ?? 0n,
              toNadzir: (l.args?.toNadzir as bigint) ?? 0n,
              bounty: (l.args?.bounty as bigint) ?? 0n,
              caller: (l.args?.caller as string) ?? "",
            }))
            .reverse(),
        );
        setLoadError(null);
      } catch {
        if (!cancelled) setLoadError("History could not be loaded from this RPC.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, stats.totalYieldStripped]);

  return (
    <Card sand>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Nazir Portal</Label>
          <h3 className="mt-2 font-serif text-2xl">Waqf fund distribution</h3>
        </div>
        <Landmark className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Stat
          label="Total Distributed"
          value={formatRp(stats.totalYieldStripped, stats.decimals)}
          tone="good"
          hint="accumulation of all harvests"
        />
        <div>
          <Label>Nazir Wallet</Label>
          <div className="mt-3">
            <AddressChip address={stats.nadzir} />
          </div>
          <p className="mt-2 text-sm text-tawf-muted">
            Proceeds are sent directly to this address by the contract, without intermediaries.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-tawf-green/10 pt-6">
        <div className="flex items-center gap-2">
          <HeartHandshake className="h-4 w-4 text-tawf-gold" aria-hidden />
          <span className="label-caps">Distribution History</span>
        </div>

        {loadError ? (
          <p className="mt-4 text-sm text-tawf-muted">{loadError}</p>
        ) : records.length === 0 ? (
          <p className="mt-4 text-sm text-tawf-muted">
            No distributions yet. Proceeds will appear here after the first harvest.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="text-tawf-muted">
                  <th className="pb-2 font-normal">Block</th>
                  <th className="pb-2 font-normal">To Nazir</th>
                  <th className="pb-2 font-normal">Bounty</th>
                  <th className="pb-2 font-normal">Caller</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className="border-t border-tawf-green/10">
                    <td className="tnum py-3 text-tawf-muted">{r.block.toString()}</td>
                    <td className="tnum py-3 text-tawf-green">
                      {formatRp(r.toNadzir, stats.decimals)}
                    </td>
                    <td className="tnum py-3 text-tawf-muted">
                      {formatRp(r.bounty, stats.decimals)}
                    </td>
                    <td className="py-3">
                      <AddressChip address={r.caller} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
