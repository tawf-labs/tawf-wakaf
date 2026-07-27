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
          <Label>Staking Wakaf Ritel</Label>
          <h1 className="mt-4 font-serif text-5xl leading-tight md:text-6xl">
            Wakaf uang, tanpa kehilangan pokok.
          </h1>
          <p className="mt-6 text-lg text-tawf-muted md:text-xl">
            Setorkan IDRX, pilih tenor, dan biarkan hasil stakingnya mengalir kepada Nadzir.
            Pokok Anda dikembalikan 100% setelah masa tenor dan unbonding selesai.
          </p>
          <p className="mt-4 font-serif text-xl text-tawf-green">
            Not as promises. As on-chain reality.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#wakaf" className="btn-primary">
              Mulai Berwakaf
            </a>
            <a href="#risiko" className="btn-secondary">
              Baca Risikonya
            </a>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 1, delay: 0.15 }}>
          <Card className="grid grid-cols-2 gap-8">
            <Stat
              label="Total Pokok Dikelola"
              value={formatRp(stats.totalPrincipal, stats.decimals, { compact: true })}
            />
            <Stat
              label="Tersalurkan ke Nadzir"
              value={formatRp(stats.totalYieldStripped, stats.decimals, { compact: true })}
              tone="good"
            />
            <Stat label="NAV Portofolio" value={formatRp(stats.nav, stats.decimals, { compact: true })} />
            <Stat
              label="Solvabilitas"
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
      title: "Pokok dijaga",
      body: "Hanya surplus di atas pokok ditambah buffer yang boleh keluar. Kontrak menolak panen apa pun yang akan menggerus bantalan itu.",
    },
    {
      icon: HeartHandshake,
      label: "Wakalah bil Istithmar",
      title: "Akad tercatat",
      body: "Setiap setoran mencetak sertifikat Ikrar Akad yang digambar sepenuhnya on-chain. Tenor pada sertifikat adalah tenor yang benar-benar dikunci kontrak.",
    },
    {
      icon: Landmark,
      label: "Tanpa Perantara",
      title: "Panen terbuka",
      body: "Fungsi panen dapat dipanggil siapa saja dengan imbalan kecil. Tidak ada kunci admin di antara hasil staking dan dompet Nadzir.",
    },
  ];

  return (
    <Section tone="white">
      <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
        <Label>Prinsip</Label>
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
          <p className="label-caps">Catatan Risiko</p>
        </div>

        <h2 className="mt-4 font-serif text-4xl text-white">
          Yang tidak bisa dijamin oleh kode
        </h2>

        <div className="mt-8 space-y-5 text-lg leading-relaxed">
          <p>
            Pokok Anda dicatat dalam rupiah (IDRX), tetapi dijaminkan oleh aset yang bergerak
            mengikuti harga ETH. Bila ETH melemah terhadap rupiah, nilai jaminan turun di bawah
            pokok — dan tidak ada baris kode yang bisa menciptakan selisihnya.
          </p>
          <p>
            Yang kami bangun adalah cara agar risiko itu terlihat dan bisa ditanggulangi, bukan
            dihilangkan: buffer {bpsToPercent(stats.bufferBps)} di atas pokok, cadangan stabil 30%
            yang meredam penurunan, rasio solvabilitas yang ditampilkan apa adanya, dan{" "}
            <code className="text-tawf-gold">topUp()</code> yang terbuka bagi siapa pun untuk
            menutup defisit.
          </p>
          <p className="text-white/50">
            Ini adalah properti dari pilihan asetnya, bukan bug yang bisa diperbaiki di Solidity.
            Selain itu: kontrak ini belum diaudit pihak ketiga, berjalan di testnet, dan seluruh
            token di dalamnya tidak bernilai.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
          <div>
            <p className="label-caps">Rasio Solvabilitas</p>
            <p className="tnum mt-2 font-serif text-3xl text-white">
              {bpsToPercent(stats.solvencyBps)}
            </p>
          </div>
          <div>
            <p className="label-caps">Defisit Tercatat</p>
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
