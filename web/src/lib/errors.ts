import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/// Map the vault's custom errors to something a wakif can act on.
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

export function parseContractError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return "Transaction was cancelled in wallet.";
    }

    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && MESSAGES[name]) return MESSAGES[name];
      if (reverted.reason) {
        // Plain `require` strings, e.g. the non-transferable receipt guard.
        if (reverted.reason.includes("non-transferable")) {
          return "wqIDRX is non-transferable — it is bound to your waqf position.";
        }
        return reverted.reason;
      }
      if (name) return `Transaction rejected by contract (${name}).`;
    }

    if (err.shortMessage) return err.shortMessage;
  }

  if (err instanceof Error && err.message) {
    return err.message.length > 160 ? `${err.message.slice(0, 160)}…` : err.message;
  }

  return "An unknown error occurred.";
}
