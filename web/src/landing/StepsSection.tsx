import { Link } from "react-router-dom";
import { ArrowRight, Coins, Infinity as InfinityIcon, Landmark, Sparkles } from "lucide-react";
import { CONTAINER, Reveal, RevealText, StickySteps, IsoGrid } from "../motion";
import { Label } from "../components/ui";
import { bpsToPercent, formatTenor } from "../lib/format";
import { useVaultStats } from "../lib/useVault";
import StepTimeline from "./art/StepTimeline";

/// Four steps on the art's scroll-driven spine. The per-step links are kept as a row underneath:
/// the timeline owns its own markup, so the calls to action ride below it in the same order
/// rather than being dropped.
export default function StepsSection() {
  const stats = useVaultStats();

  const steps = [
    {
      step: "01",
      title: "Choose your akad, then deposit",
      desc: "Endow permanently or lend for a fixed term. Either way the vault mints a non-transferable wqUSDC receipt and an Akad certificate NFT that states which akad you actually signed.",
      icon: <Coins />,
      cta: "Open the waqf pool",
      to: "/earn",
    },
    {
      step: "02",
      title: "Route into the basket",
      desc: "Your USDC is split across wstETH, weETH and a USDC stable reserve. The reserve stands in for the shariah RWA sleeve and cushions drawdowns.",
      icon: <Landmark />,
      cta: "Inspect the portfolio",
      to: "/harvest",
    },
    {
      step: "03",
      title: "Strip only the surplus",
      desc: `Anyone may call harvest() for a ${bpsToPercent(stats.harvestBountyBps)} bounty. Only value above the corpus plus a ${bpsToPercent(stats.bufferBps)} buffer can leave; ${bpsToPercent(stats.compoundBps)} of that is retained to compound the endowment and the rest goes straight to the Nazir.`,
      icon: <Sparkles />,
      cta: "See the Nazir ledger",
      to: "/nazir",
    },
    {
      step: "04",
      title: "Endure, or unwind",
      desc: `A perpetual endowment simply keeps producing, so there is nothing to wait for and nothing to claim. A fixed-tenor position matures, you request withdrawal, and after ${stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "the unbonding period"} you claim your principal back in full.`,
      icon: <InfinityIcon />,
      cta: "Track your positions",
      to: "/dashboard",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-24 overflow-clip border-t border-tawf-line bg-glaze py-16 md:py-24"
    >
      <IsoGrid cx="80%" cy="30%" r="70%" />
      <div className={`${CONTAINER} relative z-10`}>
        <Reveal className="max-w-3xl">
          <Label>How It Works</Label>
          <RevealText as="h2" text="Four steps, all of them on-chain" className="mt-4 text-[clamp(30px,4.2vw,46px)] font-medium leading-[1.06] text-tawf-ink" />
        </Reveal>

        <div className="mt-12 md:mt-16">
          <StickySteps panel="#FBFCFA" steps={steps} fallback={<StepTimeline steps={steps} />} />
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4">
          {steps.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-tawf-accent transition-colors hover:text-tawf-accent-deep"
            >
              {s.cta}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
