import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "./config";
import { MockIDRXAbi, SWRVaultAbi } from "../generated/abis";

const vault = CONTRACTS.vault as `0x${string}`;
const idrx = CONTRACTS.idrx as `0x${string}`;

export type Position = {
  principal: bigint;
  reserved: bigint;
  depositedAt: bigint;
  tenor: bigint;
  unbondingStart: bigint;
  unbondingPeriod: bigint;
  akadTokenId: bigint;
  status: number; // 0 Active, 1 Unbonding, 2 Claimed
};

/// Vault-wide figures. Polled on a 4s interval — inside the "responsive but not runaway" band;
/// tighter than this on a public RPC is how you get rate-limited.
export function useVaultStats() {
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { address: vault, abi: SWRVaultAbi, functionName: "totalPrincipal" },
      { address: vault, abi: SWRVaultAbi, functionName: "totalNavIDRX" },
      { address: vault, abi: SWRVaultAbi, functionName: "harvestFloor" },
      { address: vault, abi: SWRVaultAbi, functionName: "requiredBuffer" },
      { address: vault, abi: SWRVaultAbi, functionName: "solvencyRatioBps" },
      { address: vault, abi: SWRVaultAbi, functionName: "totalYieldStripped" },
      { address: vault, abi: SWRVaultAbi, functionName: "deficit" },
      { address: vault, abi: SWRVaultAbi, functionName: "nadzir" },
      { address: vault, abi: SWRVaultAbi, functionName: "reservedForClaims" },
      { address: vault, abi: SWRVaultAbi, functionName: "unbondingPrincipal" },
      { address: vault, abi: SWRVaultAbi, functionName: "totalAdapterETH" },
      { address: vault, abi: SWRVaultAbi, functionName: "adapterCount" },
      { address: vault, abi: SWRVaultAbi, functionName: "tenorOptionsList" },
      { address: vault, abi: SWRVaultAbi, functionName: "unbondingPeriod" },
      { address: vault, abi: SWRVaultAbi, functionName: "minDeposit" },
      { address: vault, abi: SWRVaultAbi, functionName: "decimals" },
      { address: vault, abi: SWRVaultAbi, functionName: "bufferBps" },
      { address: vault, abi: SWRVaultAbi, functionName: "harvestBountyBps" },
    ],
    query: { refetchInterval: 4000 },
  });

  const v = <T,>(i: number): T | undefined =>
    data?.[i]?.status === "success" ? (data[i].result as T) : undefined;

  // NAV is priced through the oracle, so it reverts outright when the feed goes stale rather
  // than quietly serving a frozen number. Surfacing that as its own state lets the UI tell the
  // user to poke the oracle instead of showing a broken dash.
  const navFailed = data?.[1]?.status === "failure";

  return {
    isLoading,
    refetch,
    oracleStale: navFailed,
    totalPrincipal: v<bigint>(0),
    nav: v<bigint>(1),
    harvestFloor: v<bigint>(2),
    requiredBuffer: v<bigint>(3),
    solvencyBps: v<bigint>(4),
    totalYieldStripped: v<bigint>(5),
    deficit: v<bigint>(6),
    nadzir: v<string>(7),
    reservedForClaims: v<bigint>(8),
    unbondingPrincipal: v<bigint>(9),
    adapterEth: v<bigint>(10),
    adapterCount: v<bigint>(11),
    tenors: v<readonly bigint[]>(12),
    unbondingPeriod: v<bigint>(13),
    minDeposit: v<bigint>(14),
    decimals: v<number>(15) ?? 2,
    bufferBps: v<bigint>(16),
    harvestBountyBps: v<bigint>(17),
  };
}

export function useWakif() {
  const { address } = useAccount();

  const { data: positions, refetch: refetchPositions } = useReadContract({
    address: vault,
    abi: SWRVaultAbi,
    functionName: "positionsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const { data: idrxBalance, refetch: refetchBalance } = useReadContract({
    address: idrx,
    abi: MockIDRXAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: idrx,
    abi: MockIDRXAbi,
    functionName: "allowance",
    args: address ? [address, vault] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  const { data: wqBalance, refetch: refetchWq } = useReadContract({
    address: vault,
    abi: SWRVaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  return {
    address,
    positions: (positions as Position[] | undefined) ?? [],
    idrxBalance: idrxBalance as bigint | undefined,
    allowance: (allowance as bigint | undefined) ?? 0n,
    wqBalance: wqBalance as bigint | undefined,
    refetchAll: () => {
      refetchPositions();
      refetchBalance();
      refetchAllowance();
      refetchWq();
    },
  };
}

/// Adapter-by-adapter breakdown, so the basket is visible rather than asserted.
export function useAdapters(count: number) {
  const { data } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({
      address: vault,
      abi: SWRVaultAbi,
      functionName: "adapterInfo" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: count > 0, refetchInterval: 8000 },
  });

  return (
    data?.map((r) =>
      r.status === "success"
        ? (r.result as unknown as [string, string, bigint, bigint, bigint])
        : undefined,
    ) ?? []
  );
}
