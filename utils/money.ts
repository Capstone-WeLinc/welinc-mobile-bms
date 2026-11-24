/**
 * 8790 -> "₱8,790"; 1234.5 -> "₱1,234.50".
 * Pass `alwaysShowCents` to always print centavos: 130 -> "₱130.00".
 */
export function formatPeso(amount: number, { alwaysShowCents = false }: { alwaysShowCents?: boolean } = {}): string {
  const [whole, cents] = Math.abs(amount).toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const showCents = alwaysShowCents || cents !== "00";
  return `${amount < 0 ? "-" : ""}₱${withCommas}${showCents ? `.${cents}` : ""}`;
}

export type PaymentBreakdown = {
  /** Full cost of the service before any payment */
  totalAmount: number;
  /** Already paid by the client; 0 when none */
  downPayment: number;
  /** totalAmount - downPayment, never below 0 */
  remainingBalance: number;
};

/** Works in centavos so e.g. 10000.1 - 3000.2 is exactly 6999.90. */
export function getPaymentBreakdown(totalAmount: number, downPayment: number): PaymentBreakdown {
  const toCents = (amount: number) => (Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0);
  const totalCents = toCents(totalAmount);
  const paidCents = toCents(downPayment);
  return {
    totalAmount: totalCents / 100,
    downPayment: paidCents / 100,
    remainingBalance: Math.max(0, totalCents - paidCents) / 100,
  };
}
