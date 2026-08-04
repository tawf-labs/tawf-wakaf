import { motion } from "framer-motion";
import { AlertTriangle, Landmark, Shield, HeartHandshake } from "lucide-react";
import { Layout } from "./components/Layout";
import { DepositCard } from "./components/DepositCard";
import { PositionList } from "./components/PositionList";
import { HarvestPanel } from "./components/HarvestPanel";
import { NadzirView } from "./components/NadzirView";
import { Card, Label, MotionCard, Section, Stat, fadeUp } from "./components/ui";
import { bpsToPercent, formatRp } from "./lib/format";
import { useVaultStats } from "./lib/useVault";

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
            Cash waqf, without losing your principal.
          </h1>
          <p className="mt-6 text-lg text-tawf-muted md:text-xl">
            Deposit IDRX, choose a tenor, and let the staking yield flow to the Nazir.
            Your principal is returned 100% after the tenor and unbonding period are complete.
          </p>
          <p className="mt-4 font-serif text-xl text-tawf-green">
            Not as promises. As on-chain reality.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#wakaf" className="btn-primary">
              Start Waqf
            </a>
            <a href="#risiko" className="btn-secondary">
              Read the Risks
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
              label="Distributed to Nazir"
              value={formatRp(stats.totalYieldStripped, stats.decimals, { compact: true })}
              tone="good"
            />
            <Stat label="Portfolio NAV" value={formatRp(stats.nav, stats.decimals, { compact: true })} />
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

function Pillars() {
  const items = [
    {
      icon: Shield,
      label: "Hifzul Mal",
      title: "Principal safeguarded",
      body: "Only surplus above principal plus buffer may exit. The contract rejects any harvest that would erode that cushion.",
    },
    {
      icon: HeartHandshake,
      label: "Wakalah bil Istithmar",
      title: "Akad recorded",
      body: "Every deposit mints an Akad Pledge certificate rendered entirely on-chain. The tenor on the certificate is the tenor actually locked by the contract.",
    },
    {
      icon: Landmark,
      label: "Without Intermediaries",
      title: "Open harvesting",
      body: "The harvest function can be called by anyone for a small reward. There is no admin key between the staking yield and the Nazir's wallet.",
    },
  ];

  return (
    <Section tone="white">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
        <Label>Principles</Label>
        <h2 className="mt-4 font-serif text-4xl">Baitul Maal, rebuilt for the digital age</h2>
      </motion.div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {items.map((it, i) => (
          <MotionCard key={it.title} delay={i * 0.1}>
            <Card sand className="h-full">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white">
                <it.icon className="h-8 w-8 text-tawf-gold" aria-hidden />
              </div>
              <p className="label-caps mt-6">{it.label}</p>
              <h3 className="mt-2 font-serif text-xl">{it.title}</h3>
              <p className="mt-3 text-tawf-muted">{it.body}</p>
            </Card>
          </MotionCard>
        ))}
      </div>
    </Section>
  );
}

function RiskNote() {
  const stats = useVaultStats();

  return (
    <Section tone="ink" className="text-white/70">
      <div id="risiko" className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-tawf-gold" aria-hidden />
          <p className="label-caps">Risk Notes</p>
        </div>

        <h2 className="mt-4 font-serif text-4xl text-white">
          What Code Cannot Guarantee
        </h2>

        <div className="mt-8 space-y-5 text-lg leading-relaxed">
          <p>
            Your principal is recorded in rupiah (IDRX), but is collateralized by assets
            that move with the ETH price. If ETH weakens against rupiah, the collateral
            value drops below principal — and no line of code can create the difference.
          </p>
          <p>
            What we are building is a way for that risk to be visible and manageable, not
            eliminated: a buffer {bpsToPercent(stats.bufferBps)} above principal, a 30%
            stable reserve that cushions downturns, a solvency ratio displayed as-is, and{" "}
            <code className="text-tawf-gold">topUp()</code> open to anyone to
            cover the deficit.
          </p>
          <p className="text-white/50">
            This is a property of the asset choice, not a bug that can be fixed in Solidity.
            Additionally: this contract has not been third-party audited, runs on testnet,
            and all tokens within it have no value.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
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
        </div>
      </div>
    </Section>
  );
}

export default function App() {
  return (
    <Layout>
      <Hero />
      <Pillars />

      <Section tone="sand">
        <div id="wakaf" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MotionCard>
            <DepositCard />
          </MotionCard>
          <MotionCard delay={0.1}>
            <PositionList />
          </MotionCard>
        </div>
      </Section>

      <Section tone="white">
        <div id="portofolio" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MotionCard>
            <HarvestPanel />
          </MotionCard>
          <MotionCard delay={0.1}>
            <div id="nadzir">
              <NadzirView />
            </div>
          </MotionCard>
        </div>
      </Section>

      <RiskNote />
    </Layout>
  );
}
