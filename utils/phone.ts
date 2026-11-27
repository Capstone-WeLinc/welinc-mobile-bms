// Philippine mobile number helpers.

/** "0917 123 4567", "+63 917-123-4567", "9171234567" -> "+639171234567"; null if not a PH mobile number. */
export function normalizePhMobile(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let national: string | null = null;
  if (/^09\d{9}$/.test(digits)) national = digits.slice(1);
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^9\d{9}$/.test(digits)) national = digits;
  return national ? `+63${national}` : null;
}

/** "+639171234567" -> "+63 917 123 4567" */
export function formatPhMobile(e164: string): string {
  const national = e164.replace(/^\+63/, "");
  if (!/^9\d{9}$/.test(national)) return e164;
  return `+63 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
}

/** The 10 digits after +63 of a stored number ("+639171234567" -> "9171234567"); "" if none. */
export function phLocalDigits(stored: string | null | undefined): string {
  const e164 = normalizePhMobile(stored ?? "");
  return e164 ? e164.slice(3) : "";
}

/**
 * Typed digits for the +63 field: numbers only, at most 10. A pasted 09... or 639... number is
 * cut down to its 10 digits.
 */
export function cleanPhLocalInput(text: string): string {
  let digits = text.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) digits = digits.slice(1);
  else if (/^639\d{9}$/.test(digits)) digits = digits.slice(2);
  return digits.slice(0, 10);
}

/** A complete PH mobile number after +63: 10 digits starting with 9. */
export function isValidPhLocal(digits: string): boolean {
  return /^9\d{9}$/.test(digits);
}

/** "9171234567" -> "917 123 4567" (partial input is spaced as far as it goes). */
export function spacePhLocal(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6)].filter(Boolean).join(" ");
}
