import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Coins, Droplets, Info, Infinity as InfinityIcon, Lock } from "lucide-react";
import { CONTRACTS, activeChain } from "../lib/config";
import { MockIDRXAbi, SWRVaultAbi } from "../generated/abis";
import { bpsToPercent, formatRp, formatTenor, parseRp } from "../lib/format";
import { useOnchainAction } from "../lib/useOnchainAction";
import { useVaultStats, useWaqif } from "../lib/useVault";
import { Button, Card, ErrorNote, Label, SuccessNote } from "./ui";

const vault = CONTRACTS.vault as `0x${string}`;
const idrx = CONTRACTS.idrx as `0x${string}`;

export function DepositCard() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const stats = useVaultStats();
  const waqif = useWaqif();

  const [amountInput, setAmountInput] = useState("100000");
  const [tenorIndex, setTenorIndex] = useState(0);
  /// Perpetual is the default. Waqf in its classical form is perpetual and irrevocable, and the
  /// fixed-tenor product is the accommodation, not the other way round.
  const [perpetual, setPerpetual] = useState(true);

  const refresh = () => {
    waqif.refetchAll();
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
  const needsApproval = amount > 0n && waqif.allowance < amount;
  const insufficient = waqif.idrxBalance !== undefined && amount > waqif.idrxBalance;
  const belowMin = stats.minDeposit !== undefined && amount > 0n && amount < stats.minDeposit;

  const ethEstimate = stats.nav !== undefined && amount > 0n ? amount : 0n;

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Waqf Deposit</Label>
          <h3 className="mt-2 font-serif text-2xl">Deposit IDRX, principal stays intact</h3>
        </div>
        <Coins className="h-8 w-8 shrink-0 text-tawf-gold" aria-hidden />
      </div>

      <p className="mt-3 text-tawf-muted">
        {perpetual
          ? "A perpetual endowment. The corpus is given permanently, is never returned to you, and is preserved on-chain so its yield can reach the Nazir indefinitely."
          : "Your principal is returned 100% after the tenor and unbonding period are complete. Only the yield above principal is distributed to the Nazir."}
      </p>

      {/* Akad type. Chosen first, because it changes what every field below means. */}
      <div className="mt-8">
        <span className="label-caps">Akad Type</span>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            onClick={() => setPerpetual(true)}
            aria-pressed={perpetual}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
              perpetual
                ? "border-tawf-green bg-tawf-green text-tawf-sand"
                : "border-tawf-green/15 bg-white text-tawf-ink hover:border-tawf-green/40"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <InfinityIcon className="h-4 w-4" aria-hidden />
              Perpetual
            </span>
            <span className={`mt-1 block text-xs ${perpetual ? "text-tawf-sand/70" : "text-tawf-muted"}`}>
              Waqf mu'abbad. Irrevocable, never withdrawn
            </span>
          </button>

          <button
            onClick={() => setPerpetual(false)}
            aria-pressed={!perpetual}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
              !perpetual
                ? "border-tawf-green bg-tawf-green text-tawf-sand"
                : "border-tawf-green/15 bg-white text-tawf-ink hover:border-tawf-green/40"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Lock className="h-4 w-4" aria-hidden />
              Fixed Tenor
            </span>
            <span className={`mt-1 block text-xs ${!perpetual ? "text-tawf-sand/70" : "text-tawf-muted"}`}>
              Waqf mu'aqqat. Principal returned after the term
            </span>
          </button>
        </div>
      </div>

      {/* Amount */}
      <div className="mt-8">
        <label htmlFor="amount" className="label-caps">
          Waqf Amount
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
            Balance: <span className="tnum">{formatRp(waqif.idrxBalance, decimals)}</span>
          </span>
          {ethEstimate > 0n && (
            <span className="tnum">≈ {formatRp(amount, decimals)} will be locked</span>
          )}
        </div>
      </div>

      {/* Tenor, only meaningful for the fixed-term akad. */}
      {perpetual ? (
        <div className="mt-6 rounded-2xl border border-tawf-green/15 bg-tawf-sand/40 p-5">
          <p className="flex items-start gap-2 text-sm text-tawf-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              There is no tenor and no unbonding period, because there is no withdrawal. The
              contract has no function that returns a perpetual corpus. Not to you, and not to the
              owner.{" "}
              <span className="text-tawf-green">
                {stats.compoundBps !== undefined
                  ? `${bpsToPercent(stats.compoundBps)} of each harvest is retained to grow the endowment;`
                  : "A share of each harvest is retained to grow the endowment;"}{" "}
                the rest goes to the Nazir.
              </span>
            </span>
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <span className="label-caps">Choose Tenor</span>
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
            Funds are fully locked during the tenor. After that there is still an unbonding period{" "}
            {stats.unbondingPeriod ? formatTenor(stats.unbondingPeriod) : "n/a"} before the principal
            can be claimed.
          </p>
        </div>
      )}

      {/* Four-state action flow: connect -> switch network -> approve -> deposit.
          One primary action visible at a time, and the network check comes first. */}
      <div className="mt-8 space-y-3">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <Button onClick={openConnectModal} className="w-full">
                Connect Wallet
              </Button>
            )}
          </ConnectButton.Custom>
        ) : wrongNetwork ? (
          <Button
            onClick={() => switchChain({ chainId: activeChain.id })}
            busy={isSwitching}
            busyLabel="Switching…"
            className="w-full"
          >
            Switch to {activeChain.name}
          </Button>
        ) : needsApproval ? (
          <>
            <Button
              busy={approve.busy}
              busyLabel={approve.isConfirming ? "Waiting for confirmation…" : "Approving…"}
              disabled={amount === 0n || insufficient || belowMin}
              onClick={() =>
                approve.execute({
                  address: idrx,
                  abi: MockIDRXAbi,
                  functionName: "approve",
                  // Exactly what is needed, never an unlimited approval.
                  args: [vault, amount],
                })
              }
              className="w-full"
            >
              Approve {formatRp(amount, decimals)}
            </Button>
            <p className="text-center text-sm text-tawf-muted">
              Step 1 of 2. Granting the vault permission to move exactly this amount of IDRX.
            </p>
          </>
        ) : (
          <Button
            busy={deposit.busy}
            busyLabel={deposit.isConfirming ? "Waiting for confirmation…" : "Sending…"}
            disabled={amount === 0n || insufficient || belowMin}
            onClick={() =>
              deposit.execute(
                perpetual
                  ? {
                      address: vault,
                      abi: SWRVaultAbi,
                      functionName: "depositPerpetual",
                      args: [amount],
                    }
                  : {
                      address: vault,
                      abi: SWRVaultAbi,
                      functionName: "deposit",
                      args: [amount, BigInt(tenorIndex)],
                    },
              )
            }
            className="w-full"
          >
            {perpetual ? "Endow" : "Waqf"} {formatRp(amount, decimals)}
          </Button>
        )}

        {isConnected && !wrongNetwork && (
          <Button
            variant="secondary"
            busy={faucet.busy}
            busyLabel="Fetching…"
            onClick={() =>
              faucet.execute({ address: idrx, abi: MockIDRXAbi, functionName: "faucet" })
            }
            className="w-full"
          >
            <Droplets className="h-4 w-4" aria-hidden />
            Get Testnet IDRX
          </Button>
        )}
      </div>

      {insufficient && <ErrorNote message="IDRX balance is insufficient. Use the faucet above." />}
      {belowMin && (
        <ErrorNote
          message={`Minimum deposit ${formatRp(stats.minDeposit, decimals)}.`}
        />
      )}
      {faucet.error && <ErrorNote message={faucet.error} onDismiss={faucet.clearError} />}
      {approve.error && <ErrorNote message={approve.error} onDismiss={approve.clearError} />}
      {deposit.error && <ErrorNote message={deposit.error} onDismiss={deposit.clearError} />}

      {deposit.justSucceeded && (
        <SuccessNote>
          {perpetual
            ? "Endowment recorded on-chain and now irrevocable. The Akad Certificate has been minted to your wallet."
            : "Waqf recorded on-chain. The Akad Certificate has been minted to your wallet."}
        </SuccessNote>
      )}
      {approve.justSucceeded && <SuccessNote>Approval successful. Continue to waqf deposit.</SuccessNote>}
      {faucet.justSucceeded && <SuccessNote>Testnet IDRX received.</SuccessNote>}

      {perpetual && (
        <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          This cannot be undone. Once confirmed there is no function on this contract, not for you,
          for the Nazir, or for the owner, that returns a perpetual corpus. Choose Fixed Tenor if
          you may want the money back.
        </p>
      )}

      <p className="mt-6 border-t border-tawf-green/10 pt-4 text-xs text-tawf-muted">
        Please be aware: the amount, tenor, and your wallet address are publicly recorded on
        the blockchain, and your address is also depicted on the akad certificate. This is not
        a private transaction.
      </p>
    </Card>
  );
}
