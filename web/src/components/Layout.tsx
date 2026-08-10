import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { activeChain } from "../lib/config";
import { NetworkBanner } from "./NetworkBanner";
import tawfLogo from "../assets/tawf-logo.png";

/// The tools, one route each. Splitting them out of the landing page is the whole point: a page
/// that both sells the idea and asks for a signature does neither job well.
const APP_NAV = [
  { to: "/earn", label: "Earn" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/harvest", label: "Harvest" },
  { to: "/nazir", label: "Nazir" },
  { to: "/glossary", label: "Glossary" },
] as const;

/// Marketing anchors live on `/`, so they are absolute. Clicking "Risks" from inside the app
/// has to navigate home first, not hunt for an anchor that is not on the current page.
const MARKETING_NAV = [
  { to: "/#akad", label: "Akad" },
  { to: "/#how-it-works", label: "How It Works" },
  { to: "/#principles", label: "Principles" },
  { to: "/#risks", label: "Risks" },
  { to: "/glossary", label: "Glossary" },
] as const;

/// "Cash Waqf" rather than the SWR acronym. A visitor arriving at waqf.tawf.foundation should be
/// told what this is in words they already know. The internal product code named the thing for us,
/// not for them.
///
/// The mark is imported rather than referenced from `public/`, so Vite fingerprints it and applies
/// the configured relative base. An absolute `/images/...` path would break the subpath hosting
/// that base is there to support.
function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img src={tawfLogo} alt="Tawf" className="h-20 w-auto invert" />
      <span className="hidden border-l border-tawf-green/15 pl-3 text-xs uppercase tracking-[0.2em] text-tawf-muted sm:inline">
        Cash Waqf
      </span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isApp = pathname !== "/";
  const links = isApp ? APP_NAV : MARKETING_NAV;

  return (
    <div className="min-h-screen bg-tawf-sand">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-tawf-green/10 bg-tawf-sand/90 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Wordmark />

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) =>
              isApp ? (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "text-tawf-green" : ""}`
                  }
                >
                  {l.label}
                </NavLink>
              ) : (
                <a key={l.to} href={l.to} className="nav-link">
                  {l.label}
                </a>
              ),
            )}
          </nav>

          {/* One call to action per context. The landing page asks only that you come in;
              connecting is deferred to the point where a signature is actually needed, which is
              the deposit card's own connect step. Offering both here asked for two decisions to
              do one thing, and asked for the wallet before there was anything to sign. */}
          <div className="flex items-center gap-2">
            {isApp ? (
              <ConnectButton
                showBalance={false}
                accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
              />
            ) : (
              <Link
                to="/earn"
                className="hidden items-center gap-2 rounded-full bg-tawf-green px-6 py-2.5 text-sm uppercase tracking-widest text-tawf-sand transition-colors hover:bg-tawf-green-light sm:inline-flex"
                style={{ minHeight: 44 }}
              >
                Launch App
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-tawf-ink/60 transition-colors hover:text-tawf-green md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-tawf-green/10 bg-tawf-sand px-6 py-4 md:hidden">
            <ul className="space-y-1">
              {APP_NAV.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block rounded-2xl px-4 py-3 text-sm uppercase tracking-widest transition-colors ${
                        isActive
                          ? "bg-tawf-green text-tawf-sand"
                          : "text-tawf-ink/70 hover:text-tawf-green"
                      }`
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  to="/"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-sm uppercase tracking-widest text-tawf-ink/70 hover:text-tawf-green"
                >
                  Home
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </header>

      <div className="pt-20">
        <NetworkBanner />
        <main>{children}</main>
      </div>

      <footer className="bg-tawf-ink py-16 text-white/60">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              {/* No `invert` here: the mark is already white, and the footer is already dark. */}
              <img src={tawfLogo} alt="Tawf" className="-ml-2 h-20 w-auto" />
              <p className="font-serif text-lg text-white/60">Cash Waqf</p>
              {/* This footer used to carry the Foundation's own description, which belongs on
                  tawf.foundation and not on one of its programs. */}
              <p className="mt-3 text-sm">
                On-chain cash waqf. Endow permanently or for a fixed term. The capital is preserved
                and only its yield reaches the Nazir.
              </p>
              <a
                href="https://tawf.foundation/waqf"
                className="mt-3 inline-block text-sm transition-colors hover:text-tawf-gold"
              >
                A program of Tawf Islamic Foundation ↗
              </a>
            </div>

            <div>
              <p className="label-caps">Protocol</p>
              <ul className="mt-4 space-y-2 text-sm">
                {APP_NAV.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="transition-colors hover:text-tawf-gold">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="label-caps">Transparency</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link to="/#risks" className="transition-colors hover:text-tawf-gold">
                    Risk Notes
                  </Link>
                </li>
                <li>
                  <Link to="/#how-it-works" className="transition-colors hover:text-tawf-gold">
                    How It Works
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/tawf-labs/tawf-wakaf"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition-colors hover:text-tawf-gold"
                  >
                    Source Code
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="label-caps">Network</p>
              <p className="mt-4 text-sm">{activeChain.name}</p>
              <p className="mt-2 text-sm">
                Testnet. All tokens are play money with no value.
              </p>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8 text-sm">
            <p>Baitul Maal, rebuilt for the digital age. Not as promises. As on-chain reality.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
