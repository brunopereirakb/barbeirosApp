"use client";
import { useState } from "react";
import Link from "next/link";
import { Scissors, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Não foi possível processar o pedido.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-card p-8 shadow-sm border border-ink-200">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white">
            <Scissors size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-ink-900">Recuperar palavra-passe</h1>
            <p className="mt-1 text-sm text-ink-500">
              Indica o teu email e enviamos um link para escolheres uma nova.
            </p>
          </div>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 px-3 py-3 text-sm text-green-800">
              Se o email <strong>{email}</strong> estiver registado, vais receber um link de
              recuperação nos próximos minutos. Verifica também a pasta de spam.
            </div>
            <Link
              href="/login"
              className="flex items-center justify-center gap-1 text-sm text-brand-600 hover:underline"
            >
              <ArrowLeft size={14} /> Voltar ao início de sessão
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-ink-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                placeholder="nome@salao.pt"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Enviar link de recuperação
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-1 text-xs text-ink-500 hover:text-ink-700"
            >
              <ArrowLeft size={12} /> Voltar
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
