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
