import { Link } from "react-router-dom";
import { ArrowRight, Layers, ShieldCheck } from "lucide-react";
import { DepositCard } from "../components/DepositCard";
import { AddressChip, Card, Label, MotionCard, PageHeader, Section, Stat } from "../components/ui";
import { CONTRACTS } from "../lib/config";
import { bpsToPercent, formatRp, formatTenor } from "../lib/format";
import { useAdapters, useVaultStats } from "../lib/useVault";

/// The basket, stated as targets rather than asserted in prose. The 30% stable leg is not an
/// adapter — it is IDRX left unstaked in the vault — so it is listed separately.
function Basket() {
  const stats = useVaultStats();
  const adapters = useAdapters(Number(stats.adapterCount ?? 0n));

  return (
    <Card sand>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Allocation</Label>
          <h3 className="mt-2 font-serif text-2xl">Where your rupiah goes</h3>
        </div>
        <Layers className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <div className="mt-6 space-y-4">
        {adapters.map((a, i) =>
          a ? (
            <div key={i} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-tawf-ink">{a[1]}</p>
                <AddressChip address={a[0]} />
              </div>
              <p className="tnum shrink-0 font-serif text-2xl text-tawf-green">
                {Number(a[2]) / 100}%
              </p>
            </div>
          ) : null,
        )}

        <div className="flex items-start justify-between gap-4 border-t border-tawf-green/10 pt-4">
          <div>
            <p className="text-tawf-ink">IDRX stable reserve</p>
            <p className="mt-1 text-sm text-tawf-muted">
              Stands in for the shariah RWA sleeve, and is the first cushion when the market falls.
            </p>
          </div>
          <p className="tnum shrink-0 font-serif text-2xl text-tawf-green">30%</p>
        </div>
      </div>

      <Link
        to="/harvest"
        className="mt-6 inline-flex items-center gap-2 text-sm text-tawf-green transition-colors hover:text-tawf-gold"
      >
        See live balances and NAV
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}

function PoolTerms() {
  const stats = useVaultStats();

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Pool Terms</Label>
          <h3 className="mt-2 font-serif text-2xl">The rules the contract enforces</h3>
        </div>
        <ShieldCheck className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6">
        <Stat
          label="Tenor Options"
          value={(stats.tenors ?? []).map(formatTenor).join(" · ") || "—"}
        />
        <Stat
          label="Unbonding"
          value={stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "—"}
          hint="after the tenor matures"
        />
        <Stat
          label="Minimum Deposit"
          value={formatRp(stats.minDeposit, stats.decimals)}
        />
        <Stat
          label="Principal Buffer"
          value={bpsToPercent(stats.bufferBps)}
          hint="must stay untouched by harvests"
        />
      </div>

      <div className="mt-8 space-y-3 border-t border-tawf-green/10 pt-6 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-tawf-muted">Vault</span>
          <AddressChip address={CONTRACTS.vault} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-tawf-muted">IDRX</span>
          <AddressChip address={CONTRACTS.idrx} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-tawf-muted">Akad certificate</span>
          <AddressChip address={CONTRACTS.akad} />
        </div>
      </div>
    </Card>
  );
}

export default function Earn() {
  const stats = useVaultStats();

  return (
    <Section tone="sand">
      <PageHeader
        eyebrow="Waqf Pool"
        title="Place your waqf"
        lead="Deposit IDRX for a fixed tenor. The principal is recorded as yours and returned in full; only the yield above it is ever distributed."
        aside={
          <div className="text-right">
            <Label>Total Principal</Label>
            <p className="tnum mt-2 font-serif text-3xl text-tawf-green">
              {formatRp(stats.totalPrincipal, stats.decimals, { compact: true })}
            </p>
          </div>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionCard>
          <DepositCard />
        </MotionCard>
        <div className="space-y-6">
          <MotionCard delay={0.08}>
            <PoolTerms />
          </MotionCard>
          <MotionCard delay={0.16}>
            <Basket />
          </MotionCard>
        </div>
      </div>
    </Section>
  );
}
