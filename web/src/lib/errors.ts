import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

/// Map the vault's custom errors to something a wakif can act on.
///
/// Without this a user sees `0x7939f424` and has no idea whether they did something wrong or the
/// app is broken. Every entry here is a real revert the contract can produce.
const MESSAGES: Record<string, string> = {
  ZeroAmount: "Jumlah tidak boleh nol.",
  ZeroAddress: "Alamat tidak valid.",
  BelowMinimum: "Jumlah di bawah setoran minimum.",
  InvalidTenorIndex: "Tenor yang dipilih tidak tersedia.",
  NoSuchPosition: "Posisi wakaf tidak ditemukan.",
  PositionNotActive: "Posisi ini sudah dalam masa unbonding atau sudah dicairkan.",
  PositionNotUnbonding: "Ajukan penarikan terlebih dahulu sebelum klaim.",
  TenorNotElapsed: "Masa tenor belum selesai. Dana masih terkunci.",
  UnbondingNotElapsed: "Masa unbonding belum selesai. Mohon tunggu.",
  NoSurplus: "Belum ada surplus hasil di atas pokok + buffer. Belum bisa dipanen.",
  SurplusTooSmall: "Surplus masih terlalu kecil untuk dipanen.",
  StaleOracle:
    "Harga oracle sudah kedaluwarsa. Tekan 'Segarkan Oracle' lalu coba lagi.",
  BadOraclePrice: "Harga oracle tidak valid.",
  WeightsExceedTotal: "Total bobot alokasi melebihi 100%.",
  LengthMismatch: "Jumlah adapter dan bobot tidak cocok.",
  AmountTooLarge: "Jumlah terlalu besar.",
  NoAdapters: "Vault belum dikonfigurasi dengan staking pool.",
  EthTransferFailed: "Transfer ETH gagal.",
  NotVault: "Hanya vault yang boleh memanggil fungsi ini.",
  OnlyVault: "Hanya vault yang boleh mencetak sertifikat akad.",
  VaultAlreadySet: "Vault sudah ditetapkan dan tidak bisa diubah.",
  InsufficientOutput:
    "Slippage melebihi batas toleransi. Coba jumlah lebih kecil.",
  InsufficientLiquidity:
    "Likuiditas swap desk tidak cukup. Isi ulang lewat router.fundWithEth().",
  UnsupportedPair: "Pasangan token tidak didukung oleh router.",
  OwnableUnauthorizedAccount: "Hanya pemilik kontrak yang boleh melakukan ini.",
};

export function parseContractError(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return "Transaksi dibatalkan di wallet.";
    }

    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && MESSAGES[name]) return MESSAGES[name];
      if (reverted.reason) {
        // Plain `require` strings, e.g. the non-transferable receipt guard.
        if (reverted.reason.includes("non-transferable")) {
          return "wqIDRX tidak dapat dipindahtangankan — ia terikat pada posisi wakaf Anda.";
        }
        return reverted.reason;
      }
      if (name) return `Transaksi ditolak kontrak (${name}).`;
    }

    if (err.shortMessage) return err.shortMessage;
  }

  if (err instanceof Error && err.message) {
    return err.message.length > 160 ? `${err.message.slice(0, 160)}…` : err.message;
  }

  return "Terjadi kesalahan yang tidak diketahui.";
}
