import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/// Map the vault's custom errors to something a waqif can act on.
///
/// Without this a user sees `0x7939f424` and has no idea whether they did something wrong or the
/// app is broken. Every entry here is a real revert the contract can produce.
const MESSAGES: Record<string, string> = {
  ZeroAmount: "Amount must not be zero.",
  ZeroAddress: "Invalid address.",
  BelowMinimum: "Amount is below the minimum deposit.",
  InvalidTenorIndex: "Selected tenor is not available.",
  NoSuchPosition: "Waqf position not found.",
  PositionNotActive: "This position is already unbonding or has been claimed.",
  PositionNotUnbonding: "Request a withdrawal before claiming.",
  PerpetualPosition:
    "This is a perpetual waqf (waqf mu'abbad). The corpus is endowed permanently and can never be withdrawn by anyone, including the contract owner.",
  CompoundTooHigh: "Endowment share exceeds the maximum the contract permits.",
  TenorNotElapsed: "Tenor period has not ended. Funds are still locked.",
  UnbondingNotElapsed: "Unbonding period has not ended. Please wait.",
  NoSurplus: "No yield surplus above principal + buffer yet. Nothing to harvest.",
  SurplusTooSmall: "Surplus is still too small to harvest.",
  StaleOracle:
    "Oracle price is stale. Press 'Refresh Oracle' and try again.",
  BadOraclePrice: "Oracle price is invalid.",
  WeightsExceedTotal: "Total allocation weight exceeds 100%.",
  LengthMismatch: "Number of adapters and weights do not match.",
  AmountTooLarge: "Amount too large.",
  NoAdapters: "Vault has not been configured with a staking pool.",
  EthTransferFailed: "ETH transfer failed.",
  NotVault: "Only the vault may call this function.",
  OnlyVault: "Only the vault may mint akad certificates.",
  VaultAlreadySet: "Vault has already been set and cannot be changed.",
  InsufficientOutput:
    "Slippage exceeds tolerance. Try a smaller amount.",
  InsufficientLiquidity:
    "Swap desk liquidity is insufficient. Refill via router.fundWithEth().",
  UnsupportedPair: "Token pair is not supported by the router.",
  OwnableUnauthorizedAccount: "Only the contract owner may do this.",
};

export interface ParsedError {
  code: string;
  message: string;
  raw?: string;
}

export function parseStructuredContractError(err: unknown): ParsedError {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return {
        code: "USER_REJECTED",
        message: "Transaction was cancelled in wallet.",
        raw: err.shortMessage || "User rejected the request",
      };
    }

    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name) {
        return {
          code: name,
          message: MESSAGES[name] || `Transaction rejected by contract (${name}).`,
          raw: reverted.message,
        };
      }
      if (reverted.reason) {
        if (reverted.reason.includes("non-transferable")) {
          return {
            code: "NON_TRANSFERABLE",
            message: "wqIDRX is non-transferable. It is bound to your waqf position.",
            raw: reverted.reason,
          };
        }
        return {
          code: "REVERT_REASON",
          message: reverted.reason,
          raw: reverted.message,
        };
      }
    }

    return {
      code: "RPC_ERROR",
      message: err.shortMessage || "Transaction execution failed on-chain.",
      raw: err.message,
    };
  }

  if (err instanceof Error && err.message) {
    const rawMsg = err.message;
    // Check if error contains specific string patterns
    for (const [code, msg] of Object.entries(MESSAGES)) {
      if (rawMsg.includes(code)) {
        return {
          code,
          message: msg,
          raw: rawMsg,
        };
      }
    }

    return {
      code: "EXECUTION_ERROR",
      message: rawMsg.length > 160 ? `${rawMsg.slice(0, 160)}…` : rawMsg,
      raw: rawMsg,
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "An unknown error occurred.",
    raw: String(err),
  };
}

export function parseContractError(err: unknown): string {
  const parsed = parseStructuredContractError(err);
  return parsed.message;
}
