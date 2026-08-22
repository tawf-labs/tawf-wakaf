import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Hash } from "viem";
import { parseStructuredContractError, type ParsedError } from "./errors";
import { useToast } from "./useToast";

type Phase = "idle" | "submitting" | "confirming" | "cooldown";

export interface OnchainActionOptions {
  actionName?: string;
  successMessage?: string;
}

/// One button, one instance of this hook. Never a shared `isLoading` across actions, which is
/// what produces buttons showing the wrong label and users double-submitting.
///
/// Automatically notifies the user via ToastContext with:
/// - Pending status + Tx Hash link
/// - Success status + Clickable Tx Hash link & explorer shortcut
/// - Error status + Specific Error Code and human-readable explanation
export function useOnchainAction(
  onConfirmed?: () => void,
  options: OnchainActionOptions = {}
) {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const { addToast, updateToast, showError } = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [hash, setHash] = useState<Hash | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [parsedError, setParsedError] = useState<ParsedError | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const activeToastId = useRef<string | undefined>(undefined);

  const actionName = options.actionName || "Transaction";

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirming) {
      setPhase("confirming");
      if (activeToastId.current && hash) {
        updateToast(activeToastId.current, {
          type: "pending",
          title: `${actionName} in Progress`,
          message: "Confirming block on-chain…",
          txHash: hash,
        });
      }
    }
  }, [isConfirming, hash, actionName, updateToast]);

  useEffect(() => {
    if (!isSuccess || !hash) return;

    setPhase("cooldown");
    if (activeToastId.current) {
      updateToast(activeToastId.current, {
        type: "success",
        title: `${actionName} Successful`,
        message: options.successMessage || "Transaction has been confirmed on-chain.",
        txHash: hash,
        autoClose: true,
        durationMs: 6000,
      });
      activeToastId.current = undefined;
    }

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
    async (
      args: Parameters<typeof writeContractAsync>[0],
      customName?: string
    ) => {
      setError(null);
      setParsedError(null);
      setPhase("submitting");
      const name = customName || actionName;

      try {
        const h = await writeContractAsync(args);
        setHash(h);

        // Show pending toast immediately with the tx hash
        const toastId = addToast({
          type: "pending",
          title: `${name} Submitted`,
          message: "Transaction sent to network, waiting for receipt…",
          txHash: h,
        });
        activeToastId.current = toastId;

        return h;
      } catch (e) {
        const pErr = parseStructuredContractError(e);
        setError(pErr.message);
        setParsedError(pErr);
        setPhase("idle");

        if (activeToastId.current) {
          updateToast(activeToastId.current, {
            type: "error",
            title: `${name} Failed`,
            errorCode: pErr.code,
            message: pErr.message,
            autoClose: true,
          });
          activeToastId.current = undefined;
        } else {
          showError(`${name} Failed`, pErr.code, pErr.message);
        }

        return undefined;
      }
    },
    [writeContractAsync, actionName, addToast, updateToast, showError],
  );

  const executeMany = useCallback(
    async (
      list: Parameters<typeof writeContractAsync>[0][],
      customName?: string
    ) => {
      setError(null);
      setParsedError(null);
      setPhase("submitting");
      const name = customName || actionName;
      let last: Hash | undefined;

      try {
        for (let i = 0; i < list.length; i++) {
          const args = list[i];
          last = await writeContractAsync(args);

          const toastId = addToast({
            id: activeToastId.current,
            type: "pending",
            title: list.length > 1 ? `${name} (Step ${i + 1}/${list.length})` : `${name} Submitted`,
            message: "Awaiting block confirmation…",
            txHash: last,
          });
          activeToastId.current = toastId;

          if (client) {
            await client.waitForTransactionReceipt({ hash: last });
          }
        }
        setHash(last);
        return last;
      } catch (e) {
        const pErr = parseStructuredContractError(e);
        setError(pErr.message);
        setParsedError(pErr);
        setPhase("idle");

        if (activeToastId.current) {
          updateToast(activeToastId.current, {
            type: "error",
            title: `${name} Failed`,
            errorCode: pErr.code,
            message: pErr.message,
            autoClose: true,
          });
          activeToastId.current = undefined;
        } else {
          showError(`${name} Failed`, pErr.code, pErr.message);
        }

        return undefined;
      }
    },
    [writeContractAsync, actionName, client, addToast, updateToast, showError],
  );

  return {
    execute,
    executeMany,
    error,
    parsedError,
    clearError: () => {
      setError(null);
      setParsedError(null);
    },
    hash,
    phase,
    busy: phase !== "idle",
    isSubmitting: phase === "submitting",
    isConfirming: phase === "confirming",
    justSucceeded: phase === "cooldown",
  };
}
