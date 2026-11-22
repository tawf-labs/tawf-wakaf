import { AlertTriangle } from "lucide-react";
import { bpsToPercent, formatUsd } from "../lib/format";
import { useVaultStats } from "../lib/useVault";

/// The risk note. Every sentence here is load-bearing and stays exactly as written, the solvency
/// figure keeps its warn tone, and none of the figures are animated: this is the section a reader
/// is meant to stop and read, not watch.
export default function RiskSection() {
  const stats = useVaultStats();

  return (
    <section
      id="risks"
      className="on-dark scroll-mt-24 bg-tawf-ink py-16 text-white/80 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-butter" aria-hidden />
            <p className="label-caps">Risk Notes</p>
          </div>

          <h2 className="mt-4 text-[clamp(30px,4.2vw,46px)] font-medium leading-[1.06] text-white">
            What Code Cannot Guarantee
          </h2>

          <div className="mt-8 space-y-5 text-lg leading-relaxed">
            <p>
              Your capital is recorded in dollars (USDC), but is collateralized by assets
              that move with the ETH price. If ETH weakens against the dollar, the collateral
              value drops below the corpus, and no line of code can create the difference.
            </p>
            <p>
              What we are building is a way for that risk to be visible and manageable, not
              eliminated: a buffer {bpsToPercent(stats.bufferBps)} above principal, a 30%
              stable reserve that cushions downturns, a solvency ratio displayed as-is, and{" "}
              <code className="text-butter">topUp()</code> open to anyone to
              cover the deficit.
            </p>
            <p>
              A perpetual endowment carries that same risk with no exit from it. That is the nature
              of the akad, not a defect: you are giving the capital away. Choose the fixed tenor if
              you may want the money back.
            </p>
            <p className="text-white/80">
              This is a property of the asset choice, not a bug that can be fixed in Solidity.
              Additionally: this contract has not been third-party audited, runs on testnet,
              and all tokens within it have no value.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
            <div>
              <p className="label-caps">Solvency Ratio</p>
              <p className="tnum mt-2 text-3xl font-medium text-white">
                {bpsToPercent(stats.solvencyBps)}
              </p>
            </div>
            <div>
              <p className="label-caps">Recorded Deficit</p>
              <p className="tnum mt-2 text-3xl font-medium text-white">
                {formatUsd(stats.deficit, stats.decimals)}
              </p>
            </div>
            <div>
              <p className="label-caps">Perpetual Corpus</p>
              <p className="tnum mt-2 text-3xl font-medium text-white">
                {formatUsd(stats.perpetualCorpus, stats.decimals)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
