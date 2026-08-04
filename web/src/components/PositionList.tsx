import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Clock, FileText, Hourglass, Wallet } from "lucide-react";
import { CONTRACTS } from "../lib/config";
import { SWRVaultAbi } from "../generated/abis";
import { formatCountdown, formatDateID, formatRp, formatTenor } from "../lib/format";
import { useOnchainAction } from "../lib/useOnchainAction";
import { useVaultStats, useWakif, type Position } from "../lib/useVault";
import { AkadCertificate } from "./AkadCertificate";
import { Button, Card, ErrorNote, Label } from "./ui";

const vault = CONTRACTS.vault as `0x${string}`;

/// Ticks once a second so countdowns move in real time. Contract state is polled far less
/// often — no need to hammer the RPC just to render a clock.
function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function PositionRow({
  position,
  index,
  decimals,
  onChanged,
}: {
  position: Position;
  index: number;
  decimals: number;
  onChanged: () => void;
}) {
  const now = useNow();
  const unstake = useOnchainAction(onChanged);
  const claim = useOnchainAction(onChanged);
  const [showAkad, setShowAkad] = useState(false);

  const maturesAt = Number(position.depositedAt) + Number(position.tenor);
  const claimableAt = Number(position.unbondingStart) + Number(position.unbondingPeriod);

  const isActive = position.status === 0;
  const isUnbonding = position.status === 1;
  const isClaimed = position.status === 2;

  const matured = now >= maturesAt;
  const claimable = now >= claimableAt;

  const statusChip = isClaimed
    ? { text: "Complete", cls: "bg-tawf-green/10 text-tawf-green" }
    : isUnbonding
      ? { text: "Unbonding", cls: "bg-amber-100 text-amber-800" }
      : matured
        ? { text: "Due", cls: "bg-tawf-gold/20 text-tawf-green" }
        : { text: "Locked", cls: "bg-tawf-green/5 text-tawf-muted" };

  return (
    <div className="rounded-2xl border border-tawf-green/10 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="tnum font-serif text-2xl text-tawf-green">
              {formatRp(position.principal, decimals)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs ${statusChip.cls}`}>
              {statusChip.text}
            </span>
          </div>
          <p className="mt-1 text-sm text-tawf-muted">
            Tenor {formatTenor(position.tenor)} · Akad {formatDateID(Number(position.depositedAt))}
          </p>
        </div>

        <button
          onClick={() => setShowAkad((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-tawf-muted transition-colors hover:text-tawf-green"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {showAkad ? "Hide" : "View"} Ikrar Akad
        </button>
      </div>

      {/* Countdown */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {isActive && (
          <span className="inline-flex items-center gap-2 text-tawf-muted">
            <Clock className="h-4 w-4" aria-hidden />
            {matured ? (
              <span className="text-tawf-green">Tenor complete — ready to withdraw</span>
            ) : (
              <>
                Remaining tenor:{" "}
                <span className="tnum text-tawf-ink">{formatCountdown(maturesAt - now)}</span>
              </>
            )}
          </span>
        )}
        {isUnbonding && (
          <span className="inline-flex items-center gap-2 text-tawf-muted">
            <Hourglass className="h-4 w-4" aria-hidden />
            {claimable ? (
              <span className="text-tawf-green">Unbonding complete — principal ready to claim</span>
            ) : (
              <>
                Remaining unbonding:{" "}
                <span className="tnum text-tawf-ink">{formatCountdown(claimableAt - now)}</span>
              </>
            )}
          </span>
        )}
        {isUnbonding && (
          <span className="tnum text-tawf-muted">
            Reserved: {formatRp(position.reserved, decimals)}
          </span>
        )}
      </div>

      {/* Actions */}
      {!isClaimed && (
        <div className="mt-5">
          {isActive ? (
            <Button
              variant="secondary"
              disabled={!matured}
              busy={unstake.busy}
              busyLabel={unstake.isConfirming ? "Waiting for confirmation…" : "Submitting…"}
              onClick={() =>
                unstake.execute({
                  address: vault,
                  abi: SWRVaultAbi,
                  functionName: "requestUnstake",
                  args: [BigInt(index)],
                })
              }
            >
              Request Withdrawal
            </Button>
          ) : (
            <Button
              disabled={!claimable}
              busy={claim.busy}
              busyLabel={claim.isConfirming ? "Waiting for confirmation…" : "Claiming…"}
              onClick={() =>
                claim.execute({
                  address: vault,
                  abi: SWRVaultAbi,
                  functionName: "claim",
                  args: [BigInt(index)],
                })
              }
            >
              <Wallet className="h-4 w-4" aria-hidden />
              Claim Principal
            </Button>
          )}
        </div>
      )}

      {unstake.error && <ErrorNote message={unstake.error} onDismiss={unstake.clearError} />}
      {claim.error && <ErrorNote message={claim.error} onDismiss={claim.clearError} />}

      {position.reserved < position.principal && isUnbonding && (
        <ErrorNote
          message={`Funds successfully reserved are less than the principal (${formatRp(
            position.principal - position.reserved,
            decimals,
          )} short). This happens when staking asset value drops against rupiah. The shortfall is recorded as a deficit and can be covered via topUp().`}
        />
      )}

      {showAkad && (
        <div className="mt-5 border-t border-tawf-green/10 pt-5">
          <AkadCertificate tokenId={position.akadTokenId} />
        </div>
      )}
    </div>
  );
}

export function PositionList() {
  const { isConnected } = useAccount();
  const wakif = useWakif();
  const stats = useVaultStats();

  const refresh = () => {
    wakif.refetchAll();
    stats.refetch();
  };

  if (!isConnected) {
    return (
      <Card sand>
        <Label>Waqf Position</Label>
        <p className="mt-3 text-tawf-muted">
          Connect your wallet to view your waqf positions and akad certificates.
        </p>
      </Card>
    );
  }

  const active = wakif.positions.filter((p) => p.status !== 2);
  const settled = wakif.positions.filter((p) => p.status === 2);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>Your Waqf Positions</Label>
          <h3 className="mt-2 font-serif text-3xl">
            {formatRp(wakif.wqBalance, stats.decimals)}{" "}
            <span className="text-lg text-tawf-muted">wqIDRX</span>
          </h3>
        </div>
        <p className="text-sm text-tawf-muted">
          {active.length} active · {settled.length} complete
        </p>
      </div>

      {wakif.positions.length === 0 ? (
        <Card sand className="mt-6">
          <p className="text-tawf-muted">
            No waqf positions yet. Start by depositing IDRX next door.
          </p>
        </Card>
      ) : (
        <div className="mt-6 space-y-4">
          {wakif.positions.map((p, i) => (
            <PositionRow
              key={i}
              position={p}
              index={i}
              decimals={stats.decimals}
              onChanged={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
