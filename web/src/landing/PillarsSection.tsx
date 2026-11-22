import { HeartHandshake, Landmark, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { CONTAINER, Stagger, StaggerItem, RevealText, Float, IsoGrid } from "../motion";
import { Label } from "../components/ui";

const ITEMS = [
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
] as const;

/// The three principles, as plain paper cards on the stone ground: one icon, one label, one
/// claim each, with nothing moving that a reader is trying to read.
export default function PillarsSection() {
  return (
    <section
      id="principles"
      className="relative scroll-mt-24 overflow-clip border-t border-tawf-line bg-tawf-sand py-16 md:py-24"
    >
      <IsoGrid cx="75%" cy="20%" r="55%" opacity={0.7} />
      <div className={`${CONTAINER} relative z-10`}>
        <div className="max-w-3xl">
          <Label>Principles</Label>
          <RevealText as="h2" text="Baitul Maal, rebuilt for the digital age" className="mt-4 text-[clamp(30px,4.2vw,46px)] font-medium leading-[1.06] text-tawf-ink" />
        </div>

        <Stagger className="mt-12 grid grid-cols-1 gap-6 md:mt-16 md:grid-cols-3" step={0.1}>
          {ITEMS.map((it, i) => (
            <StaggerItem key={it.title} className="h-full">
            <motion.article whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="card flex h-full flex-col p-6 md:p-8">
              <Float amplitude={4} duration={6 + i} delay={i * 1.2} className="w-fit">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mint">
                  <it.icon className="h-7 w-7 text-tawf-accent" aria-hidden />
                </div>
              </Float>
              <p className="label-caps mt-6">{it.label}</p>
              <h3 className="mt-2 text-xl font-medium text-tawf-ink">{it.title}</h3>
              <p className="mt-3 text-tawf-muted">{it.body}</p>
            </motion.article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
