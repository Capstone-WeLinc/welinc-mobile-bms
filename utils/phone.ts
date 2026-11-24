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
