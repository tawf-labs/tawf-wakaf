import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, foundry } from "wagmi/chains";
import { http } from "wagmi";
import addresses from "../generated/addresses.json";

export const CONTRACTS = addresses;
export const CHAIN_ID = addresses.chainId;

export const activeChain = CHAIN_ID === sepolia.id ? sepolia : foundry;

/// A user-configurable RPC beats a hardcoded one: it keeps the default provider from seeing
/// every read this app makes, and it gives a fallback if that provider blocks or rate-limits.
const STORED_RPC_KEY = "swr.rpcUrl";
export const storedRpc = () => localStorage.getItem(STORED_RPC_KEY) ?? "";
export const setStoredRpc = (url: string) => {
  if (url) localStorage.setItem(STORED_RPC_KEY, url);
  else localStorage.removeItem(STORED_RPC_KEY);
};

const rpcOverride = typeof window !== "undefined" ? storedRpc() : "";

export const wagmiConfig = getDefaultConfig({
  appName: "SWR — Staking Wakaf Ritel",
  // WalletConnect needs a project id; without one only injected wallets are offered, which is
  // a perfectly usable fallback rather than a hard failure.
  projectId: import.meta.env.VITE_WC_PROJECT_ID ?? "swr_wakaf_local",
  chains: [activeChain],
  transports: {
    [activeChain.id]: http(rpcOverride || undefined),
  },
  ssr: false,
});

export const EXPLORER =
  CHAIN_ID === sepolia.id ? "https://sepolia.etherscan.io" : "";

export const explorerLink = (addr: string, kind: "address" | "tx" = "address") =>
  EXPLORER ? `${EXPLORER}/${kind}/${addr}` : "";
