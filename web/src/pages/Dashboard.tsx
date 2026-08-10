import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ArrowRight } from "lucide-react";
import { PositionList } from "../components/PositionList";
import { Card, Label, MotionCard, PageHeader, Section, Stat } from "../components/ui";
import { formatRp } from "../lib/format";
import { useVaultStats, useWakif } from "../lib/useVault";

/// The wakif's own view. Deliberately separate from the pool page: depositing and managing what
/// you already deposited are different jobs, and mixing them is what made the old single-page
/// layout hard to read.
export default function Dashboard() {
  const { isConnected } = useAccount();
  const stats = useVaultStats();
  const wakif = useWakif();

  const active = wakif.positions.filter((p) => p.status === 0);
  const unbonding = wakif.positions.filter((p) => p.status === 1);
  const settled = wakif.positions.filter((p) => p.status === 2);

  const lockedTotal = active.reduce((sum, p) => sum + p.principal, 0n);
  const unbondingTotal = unbonding.reduce((sum, p) => sum + p.principal, 0n);

  return (
    <Section tone="sand">
      <PageHeader
        eyebrow="Your Portfolio"
        title="Waqf dashboard"
        lead="Every position you hold, its countdown, and its on-chain akad certificate."
        aside={
          <Link to="/earn" className="btn-secondary">
            New Waqf
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      {isConnected && (
        <MotionCard>
          <Card className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
            <Stat
              label="Receipt Balance"
              value={formatRp(wakif.wqBalance, stats.decimals)}
              hint="wqIDRX, non-transferable"
            />
            <Stat label="Locked" value={formatRp(lockedTotal, stats.decimals)} hint={`${active.length} position(s)`} />
            <Stat
              label="Unbonding"
              value={formatRp(unbondingTotal, stats.decimals)}
              hint={`${unbonding.length} position(s)`}
            />
            <Stat
              label="Completed"
              value={String(settled.length)}
              tone="good"
              hint="principal returned"
            />
          </Card>
        </MotionCard>
      )}

      <div className="mt-12">
        <PositionList />
      </div>

      {isConnected && wakif.positions.length === 0 && (
        <div className="mt-8">
          <Link to="/earn" className="btn-primary">
            Make your first deposit
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {/* Not a <p> wrapper: <Label> renders a paragraph, and nesting one inside another is
          invalid HTML that React flags at runtime. */}
      <div className="mt-12 border-t border-tawf-green/10 pt-6 text-sm text-tawf-muted">
        <Label>Privacy</Label>
        <p className="mt-2">
          Position amounts, tenors and your wallet address are public on-chain, and the address is
          rendered into the akad certificate image itself. Nothing here is private.
        </p>
      </div>
    </Section>
  );
}
