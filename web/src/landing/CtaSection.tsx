import { Link } from "react-router-dom";
import { ArrowRight, Wallet } from "lucide-react";
import { CONTAINER, Reveal, RevealText, Magnetic, TurningPattern, Float } from "../motion";

/// The closing ask. One primary action and one that shows the protocol's health, on the same
/// stone ground the page opened from.
export default function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-tawf-line bg-tawf-sand py-16 md:py-24">
      <TurningPattern />
      <div className={`${CONTAINER} relative z-10`}>
        <Reveal className="mx-auto max-w-3xl text-center">
          <Float amplitude={5} duration={6} className="mx-auto w-fit"><Wallet className="h-10 w-10 text-tawf-accent" aria-hidden /></Float>
          <RevealText as="h2" text="Ready to place your waqf?" className="mt-6 text-[clamp(30px,4.2vw,46px)] font-medium leading-[1.06] text-tawf-ink" />
          <p className="mx-auto mt-4 max-w-[34em] text-lg text-tawf-muted">
            The pool runs on Arbitrum Sepolia. Get testnet USDC from Circle&apos;s faucet and deposit
            under either akad. Nothing here has monetary value.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            <Magnetic strength={8}>
              <Link to="/earn" className="btn-primary">
                Launch App
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Magnetic>
            <Link to="/harvest" className="btn-secondary">
              View Protocol Health
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
