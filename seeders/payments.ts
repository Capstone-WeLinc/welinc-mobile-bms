import type { AddOnPayment, PaymentMethod } from "../types/bms";

// TODO: load accepted payment methods from the BMS backend if they become configurable.

// Labels match the web's Daily Sales methods (Cash, BDO, GCash, Xendit), so the driver and the
// office see the same names. BANK_TRANSFER stays the stored value (spec bms/0022).
export const PAYMENT_METHODS: Array<{ key: PaymentMethod; label: string }> = [
  { key: "CASH", label: "Cash" },
  { key: "GCASH", label: "GCash" },
  { key: "BANK_TRANSFER", label: "BDO" },
  { key: "XENDIT", label: "Xendit" },
];

export const ADD_ON_PAYMENTS: Array<{ key: AddOnPayment; label: string }> = [
  { key: "COD", label: "Paid on delivery (COD)" },
  { key: "GCASH", label: "Paid via GCash" },
  { key: "BANK_TRANSFER", label: "Paid via BDO" },
  { key: "XENDIT", label: "Paid via Xendit" },
  { key: "UNPAID", label: "Not yet paid" },
];

/**
 * Maps a booking's payment method text (e.g. "GCash", "Bank Transfer", "COD") to a PaymentMethod,
 * the same way the web suggests one for Daily Sales. Null when it isn't clear.
 */
export function toPaymentMethod(text: string): PaymentMethod | null {
  const value = text.trim().toLowerCase();
  if (/gcash/.test(value)) return "GCASH";
  if (/xendit/.test(value)) return "XENDIT";
  if (/\bbdo\b|bank/.test(value)) return "BANK_TRANSFER";
  if (/\bcod\b|cash/.test(value)) return "CASH";
  return null;
}

/** The web's method name ("Cash", "BDO", "GCash", "Xendit") as the app's PaymentMethod. */
export function fromWebPaymentMethod(name: string | null | undefined): PaymentMethod | null {
  return ({ Cash: "CASH", BDO: "BANK_TRANSFER", GCash: "GCASH", Xendit: "XENDIT" } as const)[name ?? ""] ?? null;
}

/** The web's add-ons payment name, including "Unpaid", as the app's AddOnPayment. */
export function fromWebAddOnPayment(name: string | null | undefined): AddOnPayment | null {
  return ({ Cash: "COD", BDO: "BANK_TRANSFER", GCash: "GCASH", Xendit: "XENDIT", Unpaid: "UNPAID" } as const)[name ?? ""] ?? null;
}
