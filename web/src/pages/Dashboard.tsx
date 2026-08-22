import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ArrowRight } from "lucide-react";
import { PositionList } from "../components/PositionList";
import { Card, Label, MotionCard, PageHeader, Section, Stat } from "../components/ui";
import { formatUsd } from "../lib/format";
import { useVaultStats, useWaqif } from "../lib/useVault";

/// The waqif's own view. Deliberately separate from the pool page: depositing and managing what
/// you already deposited are different jobs, and mixing them is what made the old single-page
/// layout hard to read.
export default function Dashboard() {
  const { isConnected } = useAccount();
  const stats = useVaultStats();
  const waqif = useWaqif();

  // Perpetual positions are Status.Active too, so they have to be split out first or they would
  // be counted as locked-but-eventually-returnable, which is the one thing they are not.
  const endowed = waqif.positions.filter((p) => p.perpetual);
  const active = waqif.positions.filter((p) => !p.perpetual && p.status === 0);
  const unbonding = waqif.positions.filter((p) => p.status === 1);
  const settled = waqif.positions.filter((p) => p.status === 2);

  const endowedTotal = endowed.reduce((sum, p) => sum + p.principal, 0n);
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
              label="Endowed"
              value={formatUsd(endowedTotal, stats.decimals)}
              tone="good"
              hint={`${endowed.length} perpetual · never returned`}
            />
            <Stat label="Locked" value={formatUsd(lockedTotal, stats.decimals)} hint={`${active.length} fixed tenor`} />
            <Stat
              label="Unbonding"
              value={formatUsd(unbondingTotal, stats.decimals)}
              hint={`${unbonding.length} position(s)`}
            />
            <Stat
              label="Receipt Balance"
              value={formatUsd(waqif.wqBalance, stats.decimals)}
              hint={`wqUSDC · ${settled.length} completed`}
            />
          </Card>
        </MotionCard>
      )}

      <div className="mt-12">
        <PositionList />
      </div>

      {isConnected && waqif.positions.length === 0 && (
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
