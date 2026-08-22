import { NazirView } from "../components/NazirView";
import { Label, MotionCard, PageHeader, Section } from "../components/ui";
import { formatUsd } from "../lib/format";
import { useVaultStats } from "../lib/useVault";

/// Read-only beneficiary view, reconstructed from `YieldStripped` events rather than served by a
/// backend, so the ledger stays readable even if this frontend disappears.
export default function Nazir() {
  const stats = useVaultStats();

  return (
    <Section tone="sand">
      <PageHeader
        eyebrow="Nazir Portal"
        title="Where the yield went"
        lead="Every harvest, the block it landed in, and who called it. Reconstructed straight from contract events."
        aside={
          <div className="text-right">
            <Label>Total Distributed</Label>
            <p className="tnum mt-2 font-serif text-3xl text-tawf-green">
              {formatUsd(stats.totalYieldStripped, stats.decimals, { compact: true })}
            </p>
          </div>
        }
      />

      <div className="mt-12">
        <MotionCard>
          <NazirView />
        </MotionCard>
      </div>
    </Section>
  );
}
