import { HarvestPanel } from "../components/HarvestPanel";
import { TestnetLab } from "../components/TestnetLab";
import { Label, MotionCard, PageHeader, Section } from "../components/ui";
import { bpsToPercent } from "../lib/format";
import { useVaultStats } from "../lib/useVault";

/// Protocol-health page. Anyone can act here — that is the point, so it is not gated behind a
/// waqif position or an admin role.
export default function Harvest() {
  const stats = useVaultStats();

  return (
    <Section tone="sand">
      <PageHeader
        eyebrow="Protocol Health"
        title="Harvest & solvency"
        lead="NAV, the floor it may never fall below, and the permissionless call that moves the surplus to the Nazir."
        aside={
          <div className="text-right">
            <Label>Caller Bounty</Label>
            <p className="tnum mt-2 font-serif text-3xl text-tawf-green">
              {bpsToPercent(stats.harvestBountyBps)}
            </p>
          </div>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MotionCard>
          <HarvestPanel />
        </MotionCard>
        <MotionCard delay={0.08}>
          <TestnetLab />
        </MotionCard>
      </div>
    </Section>
  );
}
