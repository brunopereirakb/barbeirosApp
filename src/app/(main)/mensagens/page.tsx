"use client";
import { useEffect, useState } from "react";
import { RefreshCw, MessageCircle, Send, Bell, Megaphone, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

type Message = {
  id: string;
  channel: string;
  recipient: string;
  content: string;
  status: "sent" | "mocked" | "failed";
  context: string | null;
  sentAt: string;
};

const SCOPE_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "tomorrow", label: "Amanhã" },
  { value: "week", label: "Esta semana" },
  { value: "day", label: "Dia específico" },
  { value: "all", label: "Todos os clientes" },
];

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBroadcast, setShowBroadcast] = useState(false);

  const [sendingReminders, setSendingReminders] = useState<"today" | "tomorrow" | null>(null);
  const [reminderResult, setReminderResult] = useState<{ day: string; sent: number; total: number } | null>(null);

  const [scope, setScope] = useState<"today" | "tomorrow" | "week" | "day" | "all">("today");
  const [broadcastDate, setBroadcastDate] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ sent: number; total: number } | null>(null);

  async function load() {
    setLoading(true);
    const data = await fetch("/api/messages?limit=200").then((r) => r.json());
    setMessages(data);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  async function sendReminders(day: "today" | "tomorrow") {
    setSendingReminders(day);
    setReminderResult(null);
    const res = await fetch("/api/messages/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day }),
    });
    const data = await res.json();
    setReminderResult({ day: day === "today" ? "hoje" : "amanhã", sent: data.sent, total: data.total });
    setSendingReminders(null);
    void load();
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcasting(true);
    setBroadcastResult(null);
    const res = await fetch("/api/messages/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, date: broadcastDate || undefined, message: broadcastMsg }),
    });
    const data = await res.json();
    setBroadcastResult(data);
    setBroadcasting(false);
    setBroadcastMsg("");
    void load();
  }

  function labelType(t: string) {
    const map: Record<string, string> = {
      reminder: "Lembrete 24h", birthday: "Parabéns", broadcast: "Comunicado",
      cascade_offer: "Oferta de vaga", cascade_accepted: "Marcação confirmada",
    };
    return map[t] ?? t;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Mensagens</h1>
        <span className="text-xs text-ink-500">{messages.length} mensagens</span>
        <div className="flex-1" />
        <button onClick={load} className="rounded-md p-2 text-ink-400 hover:bg-ink-100">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="space-y-4 p-5">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {/* Reminder resend */}
          <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bell size={16} className="text-brand-500" />
              <p className="font-medium text-ink-800">Reenviar lembretes</p>
            </div>
            {reminderResult && (
              <p className="mb-2 text-xs text-green-700">
                ✓ {reminderResult.sent}/{reminderResult.total} lembretes enviados para {reminderResult.day}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => sendReminders("today")}
                disabled={sendingReminders !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-200 py-2 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-60"
              >
                {sendingReminders === "today" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Hoje
              </button>
              <button
                onClick={() => sendReminders("tomorrow")}
                disabled={sendingReminders !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {sendingReminders === "tomorrow" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Amanhã
              </button>
            </div>
          </div>

          {/* Broadcast */}
          <div className="rounded-xl border border-ink-200 bg-white shadow-sm">
            <button
              onClick={() => setShowBroadcast((v) => !v)}
              className="flex w-full items-center gap-2 p-4 text-left"
            >
              <Megaphone size={16} className="text-brand-500" />
              <p className="flex-1 font-medium text-ink-800">Comunicado em massa</p>
              {showBroadcast ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
            </button>

            {showBroadcast && (
              <form onSubmit={sendBroadcast} className="border-t border-ink-100 px-4 pb-4 pt-3 space-y-3">
                <div className="flex gap-2">
                  <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className="flex-1 rounded-lg border border-ink-300 px-2.5 py-2 text-sm outline-none focus:border-brand-500">
                    {SCOPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === "all" ? "⚠️ " : ""}{o.label}</option>)}
                  </select>
                  {scope === "day" && (
                    <input type="date" value={broadcastDate} onChange={(e) => setBroadcastDate(e.target.value)} required className="rounded-lg border border-ink-300 px-2.5 py-2 text-sm outline-none focus:border-brand-500" />
                  )}
                </div>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  rows={3}
                  required
                  placeholder="Escreva a mensagem a enviar para os clientes…"
                  className="w-full resize-none rounded-lg border border-ink-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                />
                {broadcastResult && (
                  <p className="text-xs text-green-700">✓ Enviado para {broadcastResult.sent}/{broadcastResult.total} clientes</p>
                )}
                <button type="submit" disabled={broadcasting || !broadcastMsg.trim()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60">
                  {broadcasting && <Loader2 size={14} className="animate-spin" />}
                  Enviar comunicado
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Mode info */}
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Modo <strong>mock</strong> — mensagens aparecem aqui mas não são enviadas. Configure <code>WHATSAPP_MODE=real</code> e credenciais Twilio para envio real.
        </div>

        {/* History */}
        {messages.length === 0 && !loading ? (
          <div className="rounded-xl border border-dashed border-ink-300 bg-white p-8 text-center text-sm text-ink-400">
            Nenhuma mensagem ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const ctx = m.context ? (() => { try { return JSON.parse(m.context!); } catch { return {}; } })() : {};
              return (
                <div key={m.id} className="flex gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                    <MessageCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-800 text-sm">{m.recipient}</span>
                      {ctx.type && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-500">{labelType(ctx.type)}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === "sent" ? "bg-green-50 text-green-700" : m.status === "mocked" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-600"}`}>
                        {m.status}
                      </span>
                      <span className="ml-auto text-xs text-ink-400">{new Date(m.sentAt).toLocaleString("pt-PT")}</span>
                    </div>
                    <pre className="whitespace-pre-wrap rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-600 font-sans">{m.content}</pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
