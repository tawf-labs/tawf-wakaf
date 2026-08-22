import { createContext, useContext } from "react";
import type { Hash } from "viem";

export type ToastType = "pending" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  txHash?: Hash | string;
  errorCode?: string;
  autoClose?: boolean;
  durationMs?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id"> & { id?: string }) => string;
  updateToast: (id: string, updates: Partial<ToastItem>) => void;
  removeToast: (id: string) => void;
  showSuccess: (title: string, txHash?: Hash | string, message?: string) => string;
  showError: (title: string, errorCode?: string, message?: string) => string;
  showPending: (title: string, txHash?: Hash | string, message?: string) => string;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
