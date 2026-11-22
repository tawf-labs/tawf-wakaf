import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { CONTAINER, Reveal, HeroStage, DrawnUnderline, IsoGrid, Magnetic } from "../motion";
import { Card, Label, Stat } from "../components/ui";
import { bpsToPercent, formatUsd } from "../lib/format";
import { useVaultStats } from "../lib/useVault";
import CorpusArt from "./art/CorpusArt";

/// The opening band: glaze ground, the pitch on the left, the corpus art on the right, and the
/// live vault figures under both. The figures are rendered plainly, with no count-up and no
/// reveal: a number that animates into place is a number you cannot read until it settles, and
/// these are the ones a visitor is here to check.
export default function HeroSection() {
  const stats = useVaultStats();

  return (
    <section className="relative overflow-clip bg-glaze pb-14 md:pb-20">
      <IsoGrid cx="72%" cy="40%" r="60%" />
      <div className={`${CONTAINER} relative z-10`}>
        <div className="grid items-center gap-10 pt-14 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12">
          <Reveal className="text-center lg:text-left">
            <Label>Retail Waqf Staking</Label>

            <h1 className="mt-5 text-[clamp(40px,5.2vw,68px)] font-medium leading-[1.04] tracking-[-0.035em] text-tawf-ink">
              Give once. Keep giving{" "}
              <DrawnUnderline color="#1F6B54">forever.</DrawnUnderline>
            </h1>

            <p className="mx-auto mt-6 max-w-[34em] text-[clamp(16px,1.4vw,18.5px)] leading-[1.6] text-tawf-muted lg:mx-0">
              Endow USDC permanently and the corpus is preserved on-chain while its staking yield
              reaches the Nazir, year after year. Or lend it for a fixed term and take your principal
              back in full. Both akad are enforced by the contract, not by us.
            </p>

            <p className="mt-5 text-lg font-medium text-tawf-accent">
              Not as promises. As on-chain reality.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3.5 lg:justify-start">
              <Magnetic strength={8}>
                <Link to="/earn" className="btn-primary">
                  Start Waqf
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Magnetic>
              <a href="#how-it-works" className="btn-secondary">
                How It Works
              </a>
            </div>
          </Reveal>

          <HeroStage className="mx-auto w-full max-w-[620px]">
            <CorpusArt />
          </HeroStage>
        </div>

        <Card className="mt-12 grid grid-cols-2 gap-8 p-6 md:mt-16 md:grid-cols-4 md:p-8">
          <Stat
            label="Total Principal Managed"
            value={formatUsd(stats.totalPrincipal, stats.decimals, { compact: true })}
          />
          <Stat
            label="Perpetual Corpus"
            value={formatUsd(stats.perpetualCorpus, stats.decimals, { compact: true })}
            tone="good"
          />
          <Stat
            label="Distributed to Nazir"
            value={formatUsd(stats.totalYieldStripped, stats.decimals, { compact: true })}
            tone="good"
          />
          <Stat
            label="Solvency"
            value={bpsToPercent(stats.solvencyBps)}
            tone={(stats.solvencyBps ?? 0n) >= 10_000n ? "good" : "warn"}
          />
        </Card>
      </div>
    </section>
  );
}
