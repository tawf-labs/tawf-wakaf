import { useCallback, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  Info,
  Loader2,
  X,
} from "lucide-react";
import type { Hash } from "viem";
import { explorerLink } from "../lib/config";
import { truncateAddress } from "../lib/format";
import { ToastContext, type ToastItem } from "../lib/useToast";

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (item: Omit<ToastItem, "id"> & { id?: string }) => {
      const id = item.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newToast: ToastItem = {
        ...item,
        id,
        autoClose: item.autoClose ?? (item.type !== "pending"),
        durationMs: item.durationMs ?? (item.type === "error" ? 7000 : 5000),
      };

      setToasts((prev) => {
        const existingIdx = prev.findIndex((t) => t.id === id);
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = newToast;
          return next;
        }
        return [...prev, newToast];
      });

      if (newToast.autoClose) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.durationMs);
      }

      return id;
    },
    [removeToast],
  );

  const updateToast = useCallback((id: string, updates: Partial<ToastItem>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates };
        if (updated.autoClose && updated.type !== "pending") {
          setTimeout(() => {
            setToasts((curr) => curr.filter((item) => item.id !== id));
          }, updated.durationMs ?? 5000);
        }
        return updated;
      }),
    );
  }, []);

  const showSuccess = useCallback(
    (title: string, txHash?: Hash | string, message?: string) => {
      return addToast({
        type: "success",
        title,
        message,
        txHash,
      });
    },
    [addToast],
  );

  const showError = useCallback(
    (title: string, errorCode?: string, message?: string) => {
      return addToast({
        type: "error",
        title,
        errorCode,
        message,
      });
    },
    [addToast],
  );

  const showPending = useCallback(
    (title: string, txHash?: Hash | string, message?: string) => {
      return addToast({
        type: "pending",
        title,
        message: message || "Waiting for block confirmation…",
        txHash,
        autoClose: false,
      });
    },
    [addToast],
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        updateToast,
        removeToast,
        showSuccess,
        showError,
        showPending,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastItem[];
  onClose: (id: string) => void;
}) {
  return (
    <aside
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[99999] flex w-full max-w-md flex-col gap-3 pointer-events-none px-4 sm:px-0"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
        ))}
      </AnimatePresence>
    </aside>
  );
}

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTheme = () => {
    switch (toast.type) {
      case "success":
        return {
          border: "border-tawf-green/40",
          bg: "bg-tawf-ink/95 backdrop-blur-md text-tawf-sand",
          iconBg: "bg-tawf-green/20 text-tawf-gold",
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
        };
      case "error":
        return {
          border: "border-rose-500/40",
          bg: "bg-tawf-ink/95 backdrop-blur-md text-tawf-sand",
          iconBg: "bg-rose-500/20 text-rose-400",
          icon: <AlertCircle className="h-5 w-5 text-rose-400" />,
        };
      case "pending":
        return {
          border: "border-tawf-gold/40",
          bg: "bg-tawf-ink/95 backdrop-blur-md text-tawf-sand",
          iconBg: "bg-tawf-gold/20 text-tawf-gold",
          icon: <Loader2 className="h-5 w-5 animate-spin text-amber-300" />,
        };
      case "info":
      default:
        return {
          border: "border-sky-500/40",
          bg: "bg-tawf-ink/95 backdrop-blur-md text-tawf-sand",
          iconBg: "bg-sky-500/20 text-sky-400",
          icon: <Info className="h-5 w-5 text-sky-400" />,
        };
    }
  };

  const theme = getTheme();
  const txUrl = toast.txHash ? explorerLink(toast.txHash, "tx") : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto relative w-full rounded-xl border ${theme.border} ${theme.bg} p-4 shadow-2xl transition-all`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme.iconBg}`}>
          {theme.icon}
        </div>

        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm leading-snug text-white">
              {toast.title}
            </h4>
            {toast.errorCode && (
              <span className="inline-flex items-center rounded-md bg-rose-950/80 px-2 py-0.5 font-mono text-[10px] font-medium text-rose-300 border border-rose-800/60">
                {toast.errorCode}
              </span>
            )}
          </div>

          {toast.message && (
            <p className="mt-1 text-xs text-slate-300 leading-relaxed break-words">
              {toast.message}
            </p>
          )}

          {toast.txHash && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/10 font-mono text-xs">
              <span className="text-slate-400 text-[11px]">Tx:</span>
              <span className="text-slate-200 text-[11px]">
                {truncateAddress(toast.txHash)}
              </span>

              <button
                type="button"
                onClick={() => handleCopy(toast.txHash as string)}
                className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-white/20 transition-colors"
                title="Copy Transaction Hash"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>

              {txUrl && (
                <a
                  href={txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-tawf-green/40 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-tawf-green/60 transition-colors"
                  title="View in Block Explorer"
                >
                  Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
