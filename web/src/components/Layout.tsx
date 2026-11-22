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
      <span className="hidden border-l border-tawf-line pl-3 text-xs font-medium uppercase tracking-[0.18em] text-tawf-muted sm:inline">
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
      {/* `data-chrome` is what puts the header and the footer in the foundation palette along
          with the landing page; the rest of the app keeps the tokens it was built with. */}
      <header
        data-chrome
        className="fixed inset-x-0 top-0 z-40 border-b border-tawf-line bg-tawf-sand/90 backdrop-blur"
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Wordmark />

          <nav className="hidden items-center gap-8 md:flex">
            {links.map((l) =>
              isApp ? (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "text-tawf-accent" : ""}`
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
              <Link to="/earn" className="btn-primary hidden sm:inline-flex">
                Launch App
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex h-11 w-11 items-center justify-center rounded-full text-tawf-ink/60 transition-colors hover:text-tawf-accent md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="border-t border-tawf-line bg-tawf-sand px-6 py-4 md:hidden">
            <ul className="space-y-1">
              {APP_NAV.map((l) => (
                <li key={l.to}>
                  <NavLink
                    to={l.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center rounded-xl px-4 text-sm font-medium uppercase tracking-[0.14em] transition-colors ${
                        isActive
                          ? "bg-tawf-accent text-white"
                          : "text-tawf-ink/70 hover:text-tawf-accent"
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
                  className="flex min-h-11 items-center rounded-xl px-4 text-sm font-medium uppercase tracking-[0.14em] text-tawf-ink/70 transition-colors hover:text-tawf-accent"
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

      <footer data-chrome className="on-dark bg-tawf-ink py-16 text-white/60">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div>
              {/* No `invert` here: the mark is already white, and the footer is already dark. */}
              <img src={tawfLogo} alt="Tawf" className="-ml-2 h-20 w-auto" />
              <p className="text-lg font-medium text-white">Cash Waqf</p>
              {/* This footer used to carry the Foundation's own description, which belongs on
                  tawf.foundation and not on one of its programs. */}
              <p className="mt-3 text-sm">
                On-chain cash waqf. Endow permanently or for a fixed term. The capital is preserved
                and only its yield reaches the Nazir.
              </p>
              <a
                href="https://tawf.foundation/waqf"
                className="mt-1 inline-flex min-h-11 items-center text-sm transition-colors hover:text-butter"
              >
                A program of Tawf Islamic Foundation ↗
              </a>
            </div>

            <div>
              <p className="label-caps">Protocol</p>
              <ul className="mt-3 text-sm">
                {APP_NAV.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="inline-flex min-h-11 items-center transition-colors hover:text-butter"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="label-caps">Transparency</p>
              <ul className="mt-3 text-sm">
                <li>
                  <Link
                    to="/#risks"
                    className="inline-flex min-h-11 items-center transition-colors hover:text-butter"
                  >
                    Risk Notes
                  </Link>
                </li>
                <li>
                  <Link
                    to="/#how-it-works"
                    className="inline-flex min-h-11 items-center transition-colors hover:text-butter"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/tawf-labs/tawf-wakaf"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center transition-colors hover:text-butter"
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
