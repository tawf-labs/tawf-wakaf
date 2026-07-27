/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** WalletConnect project id. Without it only injected wallets are offered. */
  readonly VITE_WC_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
