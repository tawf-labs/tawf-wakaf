import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { AlertTriangle } from "lucide-react";
import { activeChain } from "../lib/config";

/// Sits above every tool page. The deployed contracts live on exactly one chain, so a wallet
/// pointed anywhere else makes every write revert and every read return nothing, a state worth
/// naming loudly rather than letting the user discover it through a failed transaction.
export function NetworkBanner() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === activeChain.id) return null;

  return (
    <div role="alert" className="border-b border-amber-300 bg-amber-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3 text-sm text-amber-900">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1">
          Your wallet is on a different network. The Cash Waqf contracts are deployed on{" "}
          {activeChain.name}.
        </span>
        <button
          onClick={() => switchChain({ chainId: activeChain.id })}
          disabled={isPending}
          className="shrink-0 rounded-full border border-amber-700 px-4 py-1.5 text-xs uppercase tracking-widest transition-colors hover:bg-amber-700 hover:text-amber-50 disabled:opacity-50"
          style={{ minHeight: 36 }}
        >
          {isPending ? "Switching…" : `Switch to ${activeChain.name}`}
        </button>
      </div>
    </div>
  );
}
