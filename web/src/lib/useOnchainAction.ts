import { useCallback, useEffect, useRef, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Hash } from "viem";
import { parseContractError } from "./errors";

type Phase = "idle" | "submitting" | "confirming" | "cooldown";

/// One button, one instance of this hook. Never a shared `isLoading` across actions — that is
/// what produces buttons showing the wrong label and users double-submitting.
///
/// The subtle part is the two gaps that raw wagmi leaves open:
///
///   1. wallet -> hash: `isPending` goes false the moment the wallet returns a hash, which is
///      BEFORE the chain has confirmed anything. Left alone, the button re-enables mid-flight.
///   2. confirmation -> cache: even after the receipt lands, cached reads (allowance, balances)
///      are still stale for a moment.
///
/// `submitting` covers the first, `cooldown` the second. Both keep the button disabled, and the
/// `finally` is mandatory — without it a rejected transaction locks the button forever.
export function useOnchainAction(onConfirmed?: () => void) {
  const { writeContractAsync } = useWriteContract();

  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirming) setPhase("confirming");
  }, [isConfirming]);

  useEffect(() => {
    if (!isSuccess || !hash) return;

    // Only refetch once the receipt is in hand — refetching on submission reads pre-transaction
    // state and shows the user a value that is about to change.
    setPhase("cooldown");
    onConfirmed?.();

    cooldownTimer.current = setTimeout(() => {
      setPhase("idle");
      setHash(undefined);
    }, 4000);

    return () => clearTimeout(cooldownTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, hash]);

  useEffect(() => () => clearTimeout(cooldownTimer.current), []);

  const execute = useCallback(
    async (args: Parameters<typeof writeContractAsync>[0]) => {
      setError(null);
      setPhase("submitting");
      try {
        const h = await writeContractAsync(args);
        setHash(h);
        return h;
      } catch (e) {
        setError(parseContractError(e));
        setPhase("idle");
        return undefined;
      }
    },
    [writeContractAsync],
  );

  return {
    execute,
    error,
    clearError: () => setError(null),
    hash,
    phase,
    /// The single flag every button should bind `disabled` to.
    busy: phase !== "idle",
    isSubmitting: phase === "submitting",
    isConfirming: phase === "confirming",
    justSucceeded: phase === "cooldown",
  };
}
