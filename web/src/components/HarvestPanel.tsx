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
          <h3 className="mt-2 font-serif text-2xl">Panen hasil untuk Nadzir</h3>
        </div>
        <Sparkles className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <p className="mt-3 text-tawf-muted">
        Fungsi ini terbuka untuk siapa saja — tidak ada admin, tidak ada keeper istimewa. Pemanggil
        mendapat imbalan {bpsToPercent(stats.harvestBountyBps)} dari surplus yang dipanen, sisanya
        langsung ke dompet Nadzir.
      </p>

      {stats.oracleStale && (
        <ErrorNote message="Harga oracle kedaluwarsa, sehingga NAV tidak dapat dihitung. Segarkan oracle di bawah untuk melanjutkan." />
      )}

      {/* NAV breakdown */}
      <div className="mt-8 grid grid-cols-2 gap-6">
        <Stat label="NAV Portofolio" value={formatRp(stats.nav, stats.decimals)} />
        <Stat
          label="Batas Panen"
          value={formatRp(stats.harvestFloor, stats.decimals)}
          hint={`pokok + buffer ${bpsToPercent(stats.bufferBps)}`}
        />
        <Stat
          label="Surplus Tersedia"
          value={formatRp(surplus, stats.decimals)}
          tone={surplus > 0n ? "good" : "default"}
          hint={surplus > 0n ? "siap disalurkan" : "belum melampaui buffer"}
        />
        <Stat
          label="Rasio Solvabilitas"
          value={bpsToPercent(stats.solvencyBps)}
          tone={solvent ? "good" : "warn"}
          hint={solvent ? "pokok terjamin penuh" : "di bawah par — lihat catatan risiko"}
        />
      </div>

      {hasDeficit && (
        <ErrorNote
          message={`Tercatat defisit ${formatRp(
            stats.deficit,
            stats.decimals,
          )}. Ini muncul ketika nilai aset staking turun terhadap rupiah — risiko nilai tukar yang tidak bisa dihilangkan oleh kode. Siapa pun dapat menutupnya lewat topUp().`}
        />
      )}

      <div className="mt-8 space-y-3">
        <Button
          className="w-full"
          disabled={!isConnected || surplus === 0n}
          busy={harvest.busy}
          busyLabel={harvest.isConfirming ? "Menunggu konfirmasi…" : "Memanen…"}
          onClick={() =>
            harvest.execute({ address: vault, abi: SWRVaultAbi, functionName: "harvest" })
          }
        >
          <TrendingUp className="h-4 w-4" aria-hidden />
          Panen &amp; Salurkan ke Nadzir
        </Button>

        <Button
          variant="secondary"
          className="w-full"
          disabled={!isConnected}
          busy={poke.busy}
          busyLabel="Menyegarkan…"
          onClick={() =>
            poke.execute({ address: feed, abi: MockAggregatorAbi, functionName: "poke" })
          }
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Segarkan Oracle
        </Button>
      </div>

      {harvest.error && <ErrorNote message={harvest.error} onDismiss={harvest.clearError} />}
      {poke.error && <ErrorNote message={poke.error} onDismiss={poke.clearError} />}
      {harvest.justSucceeded && <SuccessNote>Hasil berhasil disalurkan kepada Nadzir.</SuccessNote>}

      {/* Basket breakdown */}
      <div className="mt-8 border-t border-tawf-green/10 pt-6">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-tawf-gold" aria-hidden />
          <span className="label-caps">Diversifikasi Portofolio</span>
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
              <p className="text-tawf-ink">Cadangan stabil IDRX</p>
              <p className="text-xs text-tawf-muted">
                pengganti sleeve RWA syariah, sekaligus bantalan pertama saat pasar turun
              </p>
            </div>
            <p className="tnum shrink-0 text-tawf-muted">30% target</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
