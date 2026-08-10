import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, Menu, Settings, X } from "lucide-react";
import { activeChain, setStoredRpc, storedRpc } from "../lib/config";
import { NetworkBanner } from "./NetworkBanner";

/// The tools, one route each. Splitting them out of the landing page is the whole point: a page
/// that both sells the idea and asks for a signature does neither job well.
const APP_NAV = [
  { to: "/earn", label: "Earn" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/harvest", label: "Harvest" },
  { to: "/nazir", label: "Nazir" },
] as const;

/// Marketing anchors live on `/`, so they are absolute — clicking "Risks" from inside the app
/// has to navigate home first, not hunt for an anchor that is not on the current page.
const MARKETING_NAV = [
  { to: "/#akad", label: "Akad" },
  { to: "/#how-it-works", label: "How It Works" },
  { to: "/#principles", label: "Principles" },
  { to: "/#risks", label: "Risks" },
] as const;

function RpcSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(storedRpc());

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="RPC Settings"
        className="flex h-11 w-11 items-center justify-center rounded-full text-tawf-ink/60 transition-colors hover:text-tawf-green"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-tawf-green/10 bg-white p-5 shadow-lg">
          <p className="label-caps">RPC Endpoint</p>
          <p className="mt-2 text-sm text-tawf-muted">
            Use your own RPC so that the default provider cannot see all read
            activity of this application.
          </p>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={activeChain.rpcUrls.default.http[0]}
            className="mt-3 w-full rounded-full border border-tawf-green/15 bg-tawf-sand/40 px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={() => {
              setStoredRpc(value.trim());
              location.reload();
            }}
            className="btn-secondary mt-3 w-full"
          >
            Save &amp; reload
          </button>
        </div>
      )}
    </div>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="font-serif text-2xl font-medium tracking-wide text-tawf-green">
      Tawf<span className="text-tawf-gold">.</span>
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

          <div className="flex items-center gap-2">
            {!isApp && (
              <Link
                to="/earn"
                className="hidden items-center gap-2 rounded-full bg-tawf-green px-6 py-2.5 text-sm uppercase tracking-widest text-tawf-sand transition-colors hover:bg-tawf-green-light sm:inline-flex"
                style={{ minHeight: 44 }}
              >
                Launch App
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
            <RpcSettings />
            <ConnectButton
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            />
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
              <p className="font-serif text-2xl text-white">
                Tawf<span className="text-tawf-gold">.</span>
              </p>
              <p className="mt-3 text-sm">
                The non-profit, public-trust cornerstone of the Tawf ecosystem.
              </p>
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
                Testnet — all tokens are play money with no value.
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
