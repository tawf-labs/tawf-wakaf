import { Infinity as InfinityIcon, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { CONTAINER, Stagger, StaggerItem, RevealText, Float, IsoGrid } from "../motion";
import { Label, Term } from "../components/ui";
import { bpsToPercent, formatTenor } from "../lib/format";
import { useVaultStats } from "../lib/useVault";
import PerpetualVignette from "./art/PerpetualVignette";
import TenorVignette from "./art/TenorVignette";

/// The two akad, side by side. Presented as a real choice with real consequences rather than a
/// toggle, because one of them cannot be undone.
export default function AkadSection() {
  const stats = useVaultStats();
  const tenorSummary = (stats.tenors ?? []).map(formatTenor).join(" · ");

  return (
    <section id="akad" className="relative scroll-mt-24 overflow-clip border-t border-tawf-line bg-white py-16 md:py-24">
      <IsoGrid cx="20%" cy="25%" r="50%" opacity={0.7} />
      <div className={`${CONTAINER} relative z-10`}>
        <div className="max-w-4xl">
          <Label>Two Akad</Label>
          <RevealText as="h2" text="Choose what happens to your capital" className="mt-4 text-[clamp(30px,4.2vw,46px)] font-medium leading-[1.06] text-tawf-ink" />
        </div>

        <Stagger className="mt-12 grid grid-cols-1 gap-6 md:mt-16 lg:grid-cols-2" step={0.1}>
          <StaggerItem className="h-full">
          <motion.article whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="card flex h-full flex-col p-6 md:p-8">
            <div className="mb-6 rounded-xl border border-tawf-line bg-paper p-4 md:p-6">
              <PerpetualVignette className="mx-auto max-w-[360px]" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <Float amplitude={4} duration={6}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint">
                  <InfinityIcon className="h-7 w-7 text-tawf-accent" aria-hidden />
                </div>
              </Float>
              <span className="rounded-full bg-tawf-accent px-3 py-1 text-xs font-medium text-white">
                Default
              </span>
            </div>

            <p className="label-caps mt-6">
              <Term name="waqf-muabbad">Waqf mu&apos;abbad</Term>
            </p>
            <h3 className="mt-2 text-2xl font-medium text-tawf-ink">Perpetual endowment</h3>
            <p className="mt-3 flex-1 text-tawf-muted">
              The corpus is given permanently and is never returned. Not to you, not to the
              Nazir, not to the contract owner. It stays invested, and{" "}
              {bpsToPercent(stats.compoundBps)} of every harvest is retained to grow it, so the
              income it produces rises over time.
            </p>

            <dl className="mt-6 space-y-2 border-t border-tawf-line pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Withdrawal</dt>
                <dd className="font-medium text-tawf-ink">No function exists</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Corpus growth</dt>
                <dd className="tnum font-medium text-tawf-ink">
                  {bpsToPercent(stats.compoundBps)} of harvest
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Reverts with</dt>
                <dd>
                  <code className="text-xs text-tawf-accent">PerpetualPosition()</code>
                </dd>
              </div>
            </dl>
          </motion.article>
          </StaggerItem>

          <StaggerItem className="h-full">
          <motion.article whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="card-sand flex h-full flex-col p-6 md:p-8">
            <div className="mb-6 rounded-xl border border-tawf-line bg-paper p-4 md:p-6">
              <TenorVignette className="mx-auto max-w-[360px]" />
            </div>

            <Float amplitude={4} duration={7} delay={1.5}>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <Shield className="h-7 w-7 text-tawf-accent" aria-hidden />
              </div>
            </Float>

            <p className="label-caps mt-6">
              <Term name="waqf-muaqqat">Waqf mu&apos;aqqat</Term>
            </p>
            <h3 className="mt-2 text-2xl font-medium text-tawf-ink">Fixed tenor</h3>
            <p className="mt-3 flex-1 text-tawf-muted">
              Your principal is locked for the term you choose, earns for the Nazir throughout,
              and is returned to you in full once the tenor and unbonding period have elapsed.
            </p>

            <dl className="mt-6 space-y-2 border-t border-tawf-line pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Withdrawal</dt>
                <dd className="font-medium text-tawf-ink">100% of principal</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Tenors</dt>
                <dd className="tnum font-medium text-tawf-ink">{tenorSummary || "n/a"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-tawf-muted">Unbonding</dt>
                <dd className="tnum font-medium text-tawf-ink">
                  {stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "n/a"}
                </dd>
              </div>
            </dl>
          </motion.article>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
