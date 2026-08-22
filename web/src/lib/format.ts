import { formatUnits } from "viem";

/// USDC base units -> a dollar string. `$750`, never `$750.00`; sub-dollar amounts (harvest
/// bounties, dust) keep two decimals so they don't render as a misleading "$0".
export function formatUsd(base: bigint | undefined, decimals: number, opts?: { compact?: boolean }): string {
  if (base === undefined) return "n/a";
  const asNumber = Number(formatUnits(base, decimals));

  if (opts?.compact && Math.abs(asNumber) >= 1_000_000) {
    return `$${new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(asNumber)}`;
  }

  const fractionDigits = asNumber !== 0 && Math.abs(asNumber) < 1 ? 2 : 0;

  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(asNumber)}`;
}

/// Parse a user-typed dollar figure into USDC base units. Accepts "$750", "1,234.56", "750000".
export function parseUsd(input: string, decimals: number): bigint {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned) return 0n;
  const [whole, frac = ""] = cleaned.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function formatEth(wei: bigint | undefined): string {
  if (wei === undefined) return "n/a";
  return `${Number(formatUnits(wei, 18)).toLocaleString("en-US", {
    maximumFractionDigits: 5,
  })} ETH`;
}

export function truncateAddress(addr?: string): string {
  if (!addr) return "n/a";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/// Seconds remaining -> a human-readable countdown.
export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Complete";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = Math.floor(secondsLeft % 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/// Tenor length in seconds -> the label shown on the tenor picker.
///
/// Pluralised, because the picker reads back the akad the waqif is about to sign and "1 Hours" in
/// that position looks like a placeholder nobody finished.
export function formatTenor(seconds: bigint): string {
  const s = Number(seconds);
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? "" : "s"}`;

  if (s >= 86400) return unit(Math.floor(s / 86400), "Day");
  if (s >= 3600) return unit(Math.floor(s / 3600), "Hour");
  return unit(Math.floor(s / 60), "Minute");
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const bpsToPercent = (bps: bigint | undefined) =>
  bps === undefined ? "n/a" : `${(Number(bps) / 100).toFixed(2)}%`;
