// Shared password policy. Used by /api/auth/register, the password-reset
// confirm endpoint, and the client-side strength hints on /register and
// /reset-password. Framework-agnostic so it works in both server routes and
// "use client" components.

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
}

export const PASSWORD_REQUIREMENTS = [
  { label: "Pelo menos 8 caracteres", test: (s: string) => s.length >= 8 },
  { label: "Uma letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { label: "Um número", test: (s: string) => /\d/.test(s) },
  { label: "Um símbolo (!@#$…)", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
] as const;

export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  for (const req of PASSWORD_REQUIREMENTS) {
    if (!req.test(pw)) errors.push(req.label);
  }
  return { ok: errors.length === 0, errors };
}
