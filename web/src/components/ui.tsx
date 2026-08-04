import { motion } from "framer-motion";
import { AlertTriangle, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { explorerLink } from "../lib/config";
import { truncateAddress } from "../lib/format";

export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as const },
};

export function Section({
  children,
  className = "",
  tone = "sand",
}: {
  children: ReactNode;
  className?: string;
  tone?: "sand" | "white" | "ink";
}) {
  const bg =
    tone === "white" ? "bg-white" : tone === "ink" ? "bg-tawf-ink" : "bg-tawf-sand";
  return (
    <section className={`${bg} py-16 md:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl px-6">{children}</div>
    </section>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="label-caps">{children}</p>;
}

export function Card({
  children,
  className = "",
  sand = false,
}: {
  children: ReactNode;
  className?: string;
  sand?: boolean;
}) {
  return <div className={`${sand ? "card-sand" : "card"} ${className}`}>{children}</div>;
}

/// A single figure with its label. `hint` carries the honest caveat where there is one.
export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "warn" ? "text-amber-700" : tone === "good" ? "text-tawf-green" : "text-tawf-ink";
  return (
    <div>
      <Label>{label}</Label>
      <p className={`tnum mt-2 font-serif text-3xl ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-sm text-tawf-muted">{hint}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  busy,
  busyLabel,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} ${className}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {busy ? (busyLabel ?? "Processing…") : children}
    </button>
  );
}

/// Persistent, inline, next to the action that failed — never a toast that vanishes before
/// the user has read it.
export function ErrorNote({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 underline" aria-label="Dismiss error">
          dismiss
        </button>
      )}
    </div>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-tawf-green/20 bg-tawf-green/5 p-4 text-sm text-tawf-green">
      <Check className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

export function AddressChip({ address, label }: { address?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!address) return <span className="text-tawf-muted">—</span>;

  const link = explorerLink(address);

  return (
    <span className="inline-flex items-center gap-2">
      {label && <span className="text-tawf-muted">{label}</span>}
      <code className="tnum rounded-full bg-tawf-green/5 px-3 py-1 text-xs text-tawf-green">
        {truncateAddress(address)}
      </code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        aria-label="Copy address"
        className="text-tawf-muted transition-colors hover:text-tawf-green"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View on block explorer"
          className="text-tawf-muted transition-colors hover:text-tawf-green"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}

export function MotionCard({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.8, ease: "easeOut", delay }}>
      {children}
    </motion.div>
  );
}
