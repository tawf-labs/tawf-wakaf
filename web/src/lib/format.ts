import { formatUnits } from "viem";

/// IDRX base units -> a rupiah string. Indonesian convention: dots for thousands, no decimals
/// on whole amounts. `Rp 750.000`, never `Rp 750,000.00`.
export function formatRp(base: bigint | undefined, decimals: number, opts?: { compact?: boolean }): string {
  if (base === undefined) return "—";
  const asNumber = Number(formatUnits(base, decimals));

  if (opts?.compact && Math.abs(asNumber) >= 1_000_000) {
    return `Rp ${new Intl.NumberFormat("id-ID", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(asNumber)}`;
  }

  // Sub-rupiah amounts (harvest bounties, dust) would otherwise render as a misleading "Rp 0".
  const fractionDigits = asNumber !== 0 && Math.abs(asNumber) < 1 ? 2 : 0;

  return `Rp ${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(asNumber)}`;
}

/// Parse a user-typed rupiah figure into IDRX base units. Accepts "750.000" and "750000".
export function parseRp(input: string, decimals: number): bigint {
  const cleaned = input.replace(/[^\d,]/g, "").replace(",", ".");
  if (!cleaned) return 0n;
  const [whole, frac = ""] = cleaned.split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function formatEth(wei: bigint | undefined): string {
  if (wei === undefined) return "—";
  return `${Number(formatUnits(wei, 18)).toLocaleString("en-US", {
    maximumFractionDigits: 5,
  })} ETH`;
}

export function truncateAddress(addr?: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/// Seconds remaining -> a human countdown in Indonesian.
export function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return "Selesai";
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = Math.floor(secondsLeft % 60);

  if (d > 0) return `${d} hari ${h} jam`;
  if (h > 0) return `${h} jam ${m} menit`;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
}

/// Tenor length in seconds -> the label shown on the tenor picker.
export function formatTenor(seconds: bigint): string {
  const s = Number(seconds);
  if (s >= 86400) return `${Math.floor(s / 86400)} Hari`;
  if (s >= 3600) return `${Math.floor(s / 3600)} Jam`;
  return `${Math.floor(s / 60)} Menit`;
}

export function formatDateID(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const bpsToPercent = (bps: bigint | undefined) =>
  bps === undefined ? "—" : `${(Number(bps) / 100).toFixed(2)}%`;
