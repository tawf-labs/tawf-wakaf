import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, foundry } from "wagmi/chains";
import { http } from "wagmi";
import addresses from "../generated/addresses.json";

export const CONTRACTS = addresses;
export const CHAIN_ID = addresses.chainId;

export const activeChain = CHAIN_ID === sepolia.id ? sepolia : foundry;

/// Pointing the app at your own RPC keeps the default provider from seeing every read it makes,
/// and gives a fallback if that provider blocks or rate-limits. It had a settings panel in the
/// header, which put a piece of node configuration in front of everyone to serve the few who
/// want it. The override still works, set from the console and documented in the README:
///
///   localStorage.setItem("swr.rpcUrl", "https://your-node")
const STORED_RPC_KEY = "swr.rpcUrl";

const rpcOverride =
  typeof window !== "undefined" ? (localStorage.getItem(STORED_RPC_KEY) ?? "") : "";

export const wagmiConfig = getDefaultConfig({
  appName: "Tawf Cash Waqf",
  // WalletConnect needs a project id. Without one only injected wallets are offered, which is
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
