"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Scissors, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/password";

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pwCheck = validatePassword(password);
  const passwordMatch = confirm.length > 0 && password === confirm;
  const canSubmit = pwCheck.ok && passwordMatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!pwCheck.ok) {
      setError(`Palavra-passe inválida: ${pwCheck.errors.join(", ")}`);
      return;
    }
    if (!passwordMatch) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Não foi possível redefinir a palavra-passe.");
      return;
    }
    router.push("/login?reset=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-card p-8 shadow-sm border border-ink-200">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white">
            <Scissors size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-ink-900">Nova palavra-passe</h1>
            <p className="mt-1 text-sm text-ink-500">Escolhe uma nova palavra-passe para a tua conta.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-ink-700">Palavra-passe</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                autoFocus
                className="w-full rounded-lg border border-ink-300 px-3 py-2 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 hover:text-ink-700"
                aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {PASSWORD_REQUIREMENTS.map((req) => {
                  const passed = req.test(password);
                  return (
                    <li
                      key={req.label}
                      className={`flex items-center gap-1.5 text-[11px] ${
                        passed ? "text-brand-600" : "text-ink-400"
                      }`}
                    >
                      {passed ? <Check size={11} /> : <X size={11} />}
                      {req.label}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-ink-700">Confirmar palavra-passe</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              placeholder="••••••••"
            />
            {confirm.length > 0 && (
              <p
                className={`text-[11px] ${
                  passwordMatch ? "text-brand-600" : "text-red-600"
                }`}
              >
                {passwordMatch ? "Palavras-passe coincidem" : "Não coincide com a anterior"}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Guardar nova palavra-passe
          </button>

          <Link
            href="/login"
            className="block text-center text-xs text-ink-500 hover:text-ink-700"
          >
            Voltar ao início de sessão
          </Link>
        </form>
      </div>
    </div>
  );
}
