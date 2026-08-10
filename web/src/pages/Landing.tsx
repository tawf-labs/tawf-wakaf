import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  HeartHandshake,
  Infinity as InfinityIcon,
  Landmark,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Card, Label, MotionCard, Section, Stat, Term } from "../components/ui";
import { fadeUp } from "../lib/motion";
import { bpsToPercent, formatRp, formatTenor } from "../lib/format";
import { useVaultStats } from "../lib/useVault";

function Hero() {
  const stats = useVaultStats();

  return (
    <Section tone="sand" className="relative overflow-hidden">
      {/* Concentric decorative circles at very low opacity, per the design system. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-end">
        <div className="h-[700px] w-[700px] rounded-full border border-tawf-green/[0.03]" />
        <div className="absolute h-[500px] w-[500px] rounded-full border border-tawf-green/[0.03]" />
        <div className="absolute h-[300px] w-[300px] rounded-full border border-tawf-gold/[0.06]" />
      </div>

      <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <motion.div {...fadeUp} className="max-w-2xl">
          <Label>Retail Waqf Staking</Label>
          <h1 className="mt-4 font-serif text-5xl leading-tight md:text-6xl">
            Give once. Keep giving forever.
          </h1>
          <p className="mt-6 text-lg text-tawf-muted md:text-xl">
            Endow IDRX permanently and the corpus is preserved on-chain while its staking yield
            reaches the Nazir, year after year. Or lend it for a fixed term and take your principal
            back in full. Both akad are enforced by the contract, not by us.
          </p>
          <p className="mt-4 font-serif text-xl text-tawf-green">
            Not as promises. As on-chain reality.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/earn" className="btn-primary">
              Start Waqf
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <a href="#how-it-works" className="btn-secondary">
              How It Works
            </a>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 1, delay: 0.15 }}>
          <Card className="grid grid-cols-2 gap-8">
            <Stat
              label="Total Principal Managed"
              value={formatRp(stats.totalPrincipal, stats.decimals, { compact: true })}
            />
            <Stat
              label="Perpetual Corpus"
              value={formatRp(stats.perpetualCorpus, stats.decimals, { compact: true })}
              tone="good"
            />
            <Stat
              label="Distributed to Nazir"
              value={formatRp(stats.totalYieldStripped, stats.decimals, { compact: true })}
              tone="good"
            />
            <Stat
              label="Solvency"
              value={bpsToPercent(stats.solvencyBps)}
              tone={(stats.solvencyBps ?? 0n) >= 10_000n ? "good" : "warn"}
            />
          </Card>
        </motion.div>
      </div>
    </Section>
  );
}

/// The two akad, side by side. Presented as a real choice with real consequences rather than a
/// toggle, because one of them cannot be undone.
function AkadTypes() {
  const stats = useVaultStats();
  const tenorSummary = (stats.tenors ?? []).map(formatTenor).join(" · ");

  return (
    <Section tone="white">
      <div id="akad" className="scroll-mt-24">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Label>Two Akad</Label>
          <h2 className="mt-4 font-serif text-4xl">Choose what happens to your capital</h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MotionCard>
            <Card className="flex h-full flex-col border-tawf-green/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tawf-green">
                  <InfinityIcon className="h-7 w-7 text-tawf-gold" aria-hidden />
                </div>
                <span className="rounded-full bg-tawf-green px-4 py-1.5 text-xs uppercase tracking-widest text-tawf-sand">
                  Default
                </span>
              </div>

              <p className="label-caps mt-6">
                <Term gloss="Perpetual waqf, the classical form. The corpus is held in perpetuity and only its usufruct is given away.">
                  Waqf mu'abbad
                </Term>
              </p>
              <h3 className="mt-2 font-serif text-2xl">Perpetual endowment</h3>
              <p className="mt-3 flex-1 text-tawf-muted">
                The corpus is given permanently and is never returned. Not to you, not to the
                Nazir, not to the contract owner. It stays invested, and{" "}
                {bpsToPercent(stats.compoundBps)} of every harvest is retained to grow it, so the
                income it produces rises over time.
              </p>

              <dl className="mt-6 space-y-2 border-t border-tawf-green/10 pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Withdrawal</dt>
                  <dd className="text-tawf-green">No function exists</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Corpus growth</dt>
                  <dd className="tnum text-tawf-green">{bpsToPercent(stats.compoundBps)} of harvest</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Reverts with</dt>
                  <dd>
                    <code className="text-xs text-tawf-green">PerpetualPosition()</code>
                  </dd>
                </div>
              </dl>
            </Card>
          </MotionCard>

          <MotionCard delay={0.1}>
            <Card sand className="flex h-full flex-col">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <Shield className="h-7 w-7 text-tawf-gold" aria-hidden />
              </div>

              <p className="label-caps mt-6">
                <Term gloss="Temporary waqf. Capital is dedicated for a fixed term, after which the corpus returns to the giver.">
                  Waqf mu'aqqat
                </Term>
              </p>
              <h3 className="mt-2 font-serif text-2xl">Fixed tenor</h3>
              <p className="mt-3 flex-1 text-tawf-muted">
                Your principal is locked for the term you choose, earns for the Nazir throughout,
                and is returned to you in full once the tenor and unbonding period have elapsed.
              </p>

              <dl className="mt-6 space-y-2 border-t border-tawf-green/10 pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Withdrawal</dt>
                  <dd className="text-tawf-green">100% of principal</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Tenors</dt>
                  <dd className="tnum text-tawf-green">{tenorSummary || "n/a"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-tawf-muted">Unbonding</dt>
                  <dd className="tnum text-tawf-green">
                    {stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "n/a"}
                  </dd>
                </div>
              </dl>
            </Card>
          </MotionCard>
        </div>
      </div>
    </Section>
  );
}

function Pillars() {
  const items = [
    {
      icon: Shield,
      label: "Hifzul Mal",
      title: "Corpus preserved",
      body: "Only surplus above the corpus plus buffer may ever leave. The contract rejects any harvest that would erode it, whether the capital is endowed forever or lent for a term.",
    },
    {
      icon: HeartHandshake,
      label: "Wakalah bil Istithmar",
      title: "Akad recorded",
      body: "Every deposit mints an Akad certificate rendered entirely on-chain, and the two akad carry different deeds. A perpetual certificate never claims your principal comes back.",
    },
    {
      icon: Landmark,
      label: "Without Intermediaries",
      title: "Open harvesting",
      body: "The harvest function can be called by anyone for a small bounty. There is no admin key between the staking yield and the Nazir's wallet.",
    },
  ];

  return (
    <Section tone="sand">
      <div id="principles" className="scroll-mt-24">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Label>Principles</Label>
          <h2 className="mt-4 font-serif text-4xl">Baitul Maal, rebuilt for the digital age</h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <MotionCard key={it.title} delay={i * 0.1}>
              <Card className="h-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-tawf-sand">
                  <it.icon className="h-8 w-8 text-tawf-gold" aria-hidden />
                </div>
                <p className="label-caps mt-6">{it.label}</p>
                <h3 className="mt-2 font-serif text-xl">{it.title}</h3>
                <p className="mt-3 text-tawf-muted">{it.body}</p>
              </Card>
            </MotionCard>
          ))}
        </div>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const stats = useVaultStats();

  const steps = [
    {
      icon: Coins,
      title: "Choose your akad, then deposit",
      body: "Endow permanently or lend for a fixed term. Either way the vault mints a non-transferable wqIDRX receipt and an Akad certificate NFT that states which akad you actually signed.",
      to: "/earn",
      cta: "Open the waqf pool",
    },
    {
      icon: Landmark,
      title: "Route into the basket",
      body: "Your rupiah is split across wstETH, weETH and an IDRX stable reserve. The reserve stands in for the shariah RWA sleeve and cushions drawdowns.",
      to: "/harvest",
      cta: "Inspect the portfolio",
    },
    {
      icon: Sparkles,
      title: "Strip only the surplus",
      body: `Anyone may call harvest() for a ${bpsToPercent(stats.harvestBountyBps)} bounty. Only value above the corpus plus a ${bpsToPercent(stats.bufferBps)} buffer can leave; ${bpsToPercent(stats.compoundBps)} of that is retained to compound the endowment and the rest goes straight to the Nazir.`,
      to: "/nazir",
      cta: "See the Nazir ledger",
    },
    {
      icon: InfinityIcon,
      title: "Endure, or unwind",
      body: `A perpetual endowment simply keeps producing, so there is nothing to wait for and nothing to claim. A fixed-tenor position matures, you request withdrawal, and after ${stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "the unbonding period"} you claim your principal back in full.`,
      to: "/dashboard",
      cta: "Track your positions",
    },
  ];

  return (
    <Section tone="white">
      <div id="how-it-works" className="scroll-mt-24">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <Label>How It Works</Label>
          <h2 className="mt-4 font-serif text-4xl">Four steps, all of them on-chain</h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {steps.map((s, i) => (
            <MotionCard key={s.title} delay={i * 0.08}>
              <Card sand className="flex h-full flex-col">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white">
                    <s.icon className="h-6 w-6 text-tawf-gold" aria-hidden />
                  </div>
                  <span className="tnum font-serif text-3xl text-tawf-green/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-5 font-serif text-xl">{s.title}</h3>
                <p className="mt-3 flex-1 text-tawf-muted">{s.body}</p>
                <Link
                  to={s.to}
                  className="mt-5 inline-flex items-center gap-2 text-sm text-tawf-green transition-colors hover:text-tawf-gold"
                >
                  {s.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Card>
            </MotionCard>
          ))}
        </div>
      </div>
    </Section>
  );
}

function RiskNote() {
  const stats = useVaultStats();

  return (
    <Section tone="ink" className="text-white/70">
      <div id="risks" className="mx-auto max-w-3xl scroll-mt-24">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-tawf-gold" aria-hidden />
          <p className="label-caps">Risk Notes</p>
        </div>

        <h2 className="mt-4 font-serif text-4xl text-white">What Code Cannot Guarantee</h2>

        <div className="mt-8 space-y-5 text-lg leading-relaxed">
          <p>
            Your capital is recorded in rupiah (IDRX), but is collateralized by assets
            that move with the ETH price. If ETH weakens against rupiah, the collateral
            value drops below the corpus, and no line of code can create the difference.
          </p>
          <p>
            What we are building is a way for that risk to be visible and manageable, not
            eliminated: a buffer {bpsToPercent(stats.bufferBps)} above principal, a 30%
            stable reserve that cushions downturns, a solvency ratio displayed as-is, and{" "}
            <code className="text-tawf-gold">topUp()</code> open to anyone to
            cover the deficit.
          </p>
          <p>
            A perpetual endowment carries that same risk with no exit from it. That is the nature
            of the akad, not a defect: you are giving the capital away. Choose the fixed tenor if
            you may want the money back.
          </p>
          <p className="text-white/50">
            This is a property of the asset choice, not a bug that can be fixed in Solidity.
            Additionally: this contract has not been third-party audited, runs on testnet,
            and all tokens within it have no value.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 border-t border-white/10 pt-8 sm:grid-cols-3">
          <div>
            <p className="label-caps">Solvency Ratio</p>
            <p className="tnum mt-2 font-serif text-3xl text-white">
              {bpsToPercent(stats.solvencyBps)}
            </p>
          </div>
          <div>
            <p className="label-caps">Recorded Deficit</p>
            <p className="tnum mt-2 font-serif text-3xl text-white">
              {formatRp(stats.deficit, stats.decimals)}
            </p>
          </div>
          <div>
            <p className="label-caps">Perpetual Corpus</p>
            <p className="tnum mt-2 font-serif text-3xl text-white">
              {formatRp(stats.perpetualCorpus, stats.decimals)}
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function LaunchCta() {
  return (
    <Section tone="sand">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
        <Wallet className="mx-auto h-10 w-10 text-tawf-gold" aria-hidden />
        <h2 className="mt-6 font-serif text-4xl">Ready to place your waqf?</h2>
        <p className="mt-4 text-lg text-tawf-muted">
          The pool runs on testnet. Claim IDRX from the faucet, deposit under either akad, and walk
          the whole lifecycle in minutes. Nothing here has monetary value.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link to="/earn" className="btn-primary">
            Launch App
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link to="/harvest" className="btn-secondary">
            View Protocol Health
          </Link>
        </div>
      </motion.div>
    </Section>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <AkadTypes />
      <Pillars />
      <HowItWorks />
      <RiskNote />
      <LaunchCta />
    </>
  );
}
