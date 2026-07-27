import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Coins, Droplets, Info } from "lucide-react";
import { CONTRACTS, activeChain } from "../lib/config";
import { MockIDRXAbi, SWRVaultAbi } from "../generated/abis";
import { formatRp, formatTenor, parseRp } from "../lib/format";
import { useOnchainAction } from "../lib/useOnchainAction";
import { useVaultStats, useWakif } from "../lib/useVault";
import { Button, Card, ErrorNote, Label, SuccessNote } from "./ui";

const vault = CONTRACTS.vault as `0x${string}`;
const idrx = CONTRACTS.idrx as `0x${string}`;

export function DepositCard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const stats = useVaultStats();
  const wakif = useWakif();

  const [amountInput, setAmountInput] = useState("100000");
  const [tenorIndex, setTenorIndex] = useState(0);

  const refresh = () => {
    wakif.refetchAll();
    stats.refetch();
  };

  // Each action gets its own hook instance. A shared loading flag is how buttons end up showing
  // the wrong label and accepting a second click mid-flight.
  const faucet = useOnchainAction(refresh);
  const approve = useOnchainAction(refresh);
  const deposit = useOnchainAction(refresh);

  const decimals = stats.decimals;
  const amount = useMemo(() => parseRp(amountInput, decimals), [amountInput, decimals]);

  const wrongNetwork = isConnected && chainId !== activeChain.id;
  const needsApproval = amount > 0n && wakif.allowance < amount;
  const insufficient = wakif.idrxBalance !== undefined && amount > wakif.idrxBalance;
  const belowMin = stats.minDeposit !== undefined && amount > 0n && amount < stats.minDeposit;

  const ethEstimate = stats.nav !== undefined && amount > 0n ? amount : 0n;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Berwakaf</Label>
          <h3 className="mt-2 font-serif text-2xl">Setor IDRX, pokok tetap utuh</h3>
        </div>
        <Coins className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <p className="mt-3 text-tawf-muted">
        Pokok Anda dikembalikan 100% setelah tenor dan masa unbonding selesai. Hanya hasil
        (yield) di atas pokok yang disalurkan kepada Nadzir.
      </p>

      {/* Amount */}
      <div className="mt-8">
        <label htmlFor="amount" className="label-caps">
          Jumlah Wakaf
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-tawf-green/15 bg-tawf-sand/40 px-4 py-3">
          <span className="font-serif text-xl text-tawf-green">Rp</span>
          <input
            id="amount"
            inputMode="numeric"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="tnum w-full bg-transparent text-xl outline-none"
            placeholder="100000"
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-tawf-muted">
          <span>
            Saldo: <span className="tnum">{formatRp(wakif.idrxBalance, decimals)}</span>
          </span>
          {ethEstimate > 0n && (
            <span className="tnum">≈ {formatRp(amount, decimals)} akan dikunci</span>
          )}
        </div>
      </div>

      {/* Tenor */}
      <div className="mt-6">
        <span className="label-caps">Pilih Tenor</span>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {(stats.tenors ?? []).map((t, i) => (
            <button
              key={i}
              onClick={() => setTenorIndex(i)}
              aria-pressed={tenorIndex === i}
              className={`rounded-2xl border px-3 py-3 text-sm transition-colors ${
                tenorIndex === i
                  ? "border-tawf-green bg-tawf-green text-tawf-sand"
                  : "border-tawf-green/15 bg-white text-tawf-ink hover:border-tawf-green/40"
              }`}
              style={{ minHeight: 44 }}
            >
              {formatTenor(t)}
            </button>
          ))}
        </div>
        <p className="mt-2 flex items-start gap-2 text-sm text-tawf-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Dana terkunci penuh selama tenor. Setelah itu masih ada masa unbonding{" "}
          {stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "—"} sebelum pokok bisa
          diklaim.
        </p>
      </div>

      {/* Four-state action flow: connect -> switch network -> approve -> deposit.
          One primary action visible at a time, and the network check comes first. */}
      <div className="mt-8 space-y-3">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <Button onClick={openConnectModal} className="w-full">
                Hubungkan Wallet
              </Button>
            )}
          </ConnectButton.Custom>
        ) : wrongNetwork ? (
          <Button
            onClick={() => switchChain({ chainId: activeChain.id })}
            busy={isSwitching}
            busyLabel="Mengalihkan…"
            className="w-full"
          >
            Pindah ke {activeChain.name}
          </Button>
        ) : needsApproval ? (
          <>
            <Button
              busy={approve.busy}
              busyLabel={approve.isConfirming ? "Menunggu konfirmasi…" : "Menyetujui…"}
              disabled={amount === 0n || insufficient || belowMin}
              onClick={() =>
                approve.execute({
                  address: idrx,
                  abi: MockIDRXAbi,
                  functionName: "approve",
                  // Exactly what is needed — never an unlimited approval.
                  args: [vault, amount],
                })
              }
              className="w-full"
            >
              Setujui {formatRp(amount, decimals)}
            </Button>
            <p className="text-center text-sm text-tawf-muted">
              Langkah 1 dari 2 — memberi izin vault memindahkan IDRX sejumlah ini saja.
            </p>
          </>
        ) : (
          <Button
            busy={deposit.busy}
            busyLabel={deposit.isConfirming ? "Menunggu konfirmasi…" : "Mengirim…"}
            disabled={amount === 0n || insufficient || belowMin}
            onClick={() =>
              deposit.execute({
                address: vault,
                abi: SWRVaultAbi,
                functionName: "deposit",
                args: [amount, BigInt(tenorIndex)],
              })
            }
            className="w-full"
          >
            Wakafkan {formatRp(amount, decimals)}
          </Button>
        )}

        {isConnected && !wrongNetwork && (
          <Button
            variant="secondary"
            busy={faucet.busy}
            busyLabel="Mengambil…"
            onClick={() =>
              faucet.execute({ address: idrx, abi: MockIDRXAbi, functionName: "faucet" })
            }
            className="w-full"
          >
            <Droplets className="h-4 w-4" aria-hidden />
            Ambil IDRX Testnet
          </Button>
        )}
      </div>

      {insufficient && <ErrorNote message="Saldo IDRX tidak mencukupi. Gunakan faucet di atas." />}
      {belowMin && (
        <ErrorNote
          message={`Minimum setoran ${formatRp(stats.minDeposit, decimals)}.`}
        />
      )}
      {faucet.error && <ErrorNote message={faucet.error} onDismiss={faucet.clearError} />}
      {approve.error && <ErrorNote message={approve.error} onDismiss={approve.clearError} />}
      {deposit.error && <ErrorNote message={deposit.error} onDismiss={deposit.clearError} />}

      {deposit.justSucceeded && (
        <SuccessNote>
          Wakaf tercatat on-chain. Sertifikat Ikrar Akad sudah dicetak ke wallet Anda.
        </SuccessNote>
      )}
      {approve.justSucceeded && <SuccessNote>Persetujuan berhasil. Lanjutkan ke wakaf.</SuccessNote>}
      {faucet.justSucceeded && <SuccessNote>IDRX testnet diterima.</SuccessNote>}

      <p className="mt-6 border-t border-tawf-green/10 pt-4 text-xs text-tawf-muted">
        Perlu diketahui: jumlah, tenor, dan alamat wallet Anda tercatat publik di blockchain, dan
        alamat Anda ikut tergambar pada sertifikat akad. Ini bukan transaksi privat.
      </p>
    </Card>
  );
}
