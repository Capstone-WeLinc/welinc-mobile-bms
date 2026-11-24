/** Rules a new password must meet. Shown as a checklist when changing the password. */
export const PASSWORD_RULES: Array<{ label: string; test: (password: string) => boolean }> = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "At least 1 uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "At least 1 lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "At least 1 number (0–9)", test: (p) => /\d/.test(p) },
  { label: "At least 1 special character (like ! @ # $ %)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function meetsPasswordRules(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
