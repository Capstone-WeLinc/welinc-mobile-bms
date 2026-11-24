import type { AddOnPayment, PaymentMethod } from "../types/bms";

// TODO: load accepted payment methods from the BMS backend if they become configurable.

export const PAYMENT_METHODS: Array<{ key: PaymentMethod; label: string }> = [
  { key: "CASH", label: "Cash" },
  { key: "GCASH", label: "GCash" },
  { key: "BANK_TRANSFER", label: "Bank Transfer" },
  { key: "XENDIT", label: "Xendit" },
];

export const ADD_ON_PAYMENTS: Array<{ key: AddOnPayment; label: string }> = [
  { key: "COD", label: "Paid on delivery (COD)" },
  { key: "GCASH", label: "Paid via GCash" },
  { key: "BANK_TRANSFER", label: "Paid via Bank Transfer" },
  { key: "XENDIT", label: "Paid via Xendit" },
  { key: "UNPAID", label: "Not yet paid" },
];

/** Maps a job order's payment method text (e.g. "GCash") to a PaymentMethod key. */
export function toPaymentMethod(text: string): PaymentMethod | null {
  return PAYMENT_METHODS.find((m) => m.label.toLowerCase() === text.trim().toLowerCase())?.key ?? null;
}
