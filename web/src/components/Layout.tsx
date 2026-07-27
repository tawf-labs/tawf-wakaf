import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { Settings } from "lucide-react";
import { activeChain, setStoredRpc, storedRpc } from "../lib/config";

function RpcSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(storedRpc());

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Pengaturan RPC"
        className="flex h-11 w-11 items-center justify-center rounded-full text-tawf-ink/60 transition-colors hover:text-tawf-green"
      >
        <Settings className="h-4 w-4" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-tawf-green/10 bg-white p-5 shadow-lg">
          <p className="label-caps">RPC Endpoint</p>
          <p className="mt-2 text-sm text-tawf-muted">
            Gunakan RPC Anda sendiri agar penyedia default tidak melihat seluruh aktivitas baca
            aplikasi ini.
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
            Simpan &amp; muat ulang
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-tawf-sand">
      <header className="fixed inset-x-0 top-0 z-40 h-20 border-b border-tawf-green/10 bg-tawf-sand/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <a href="/" className="font-serif text-2xl font-medium tracking-wide text-tawf-green">
            Tawf<span className="text-tawf-gold">.</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#wakaf" className="nav-link">
              Wakaf
            </a>
            <a href="#portofolio" className="nav-link">
              Portofolio
            </a>
            <a href="#nadzir" className="nav-link">
              Nadzir
            </a>
            <a href="#risiko" className="nav-link">
              Risiko
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <RpcSettings />
            <ConnectButton
              showBalance={false}
              accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            />
          </div>
        </div>
      </header>

      <main className="pt-20">{children}</main>

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
              <p className="label-caps">Protokol</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href="#wakaf" className="transition-colors hover:text-tawf-gold">
                    Berwakaf
                  </a>
                </li>
                <li>
                  <a href="#portofolio" className="transition-colors hover:text-tawf-gold">
                    Portofolio
                  </a>
                </li>
                <li>
                  <a href="#nadzir" className="transition-colors hover:text-tawf-gold">
                    Portal Nadzir
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="label-caps">Transparansi</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href="#risiko" className="transition-colors hover:text-tawf-gold">
                    Catatan Risiko
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/WeissCurry"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="transition-colors hover:text-tawf-gold"
                  >
                    Kode Sumber
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="label-caps">Jaringan</p>
              <p className="mt-4 text-sm">{activeChain.name}</p>
              <p className="mt-2 text-sm">
                Testnet — seluruh token adalah uang mainan tanpa nilai.
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
