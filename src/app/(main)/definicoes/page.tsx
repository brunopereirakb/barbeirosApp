"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

type Settings = {
  salonName: string;
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  cascadeWaitMinutes: number;
  reminderHoursBefore: number;
  whatsappMode: string;
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/settings").then((r) => r.json()).then(setS);
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <div className="p-5 text-sm text-ink-500">A carregar...</div>;

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Definições</h1>
        <div className="flex-1" />
        {saved && <span className="text-xs text-green-600">✓ Guardado</span>}
        <Button onClick={save} disabled={saving}>
          <Save size={14} /> {saving ? "A guardar..." : "Guardar"}
        </Button>
      </div>

      <div className="max-w-2xl p-5">
        <div className="space-y-6">
          <Section title="Salão">
            <Field label="Nome do salão">
              <input
                value={s.salonName}
                onChange={(e) => setS({ ...s, salonName: e.target.value })}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Horário de trabalho">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Abertura">
                <input
                  type="time"
                  value={s.workdayStart}
                  onChange={(e) => setS({ ...s, workdayStart: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Encerramento">
                <input
                  type="time"
                  value={s.workdayEnd}
                  onChange={(e) => setS({ ...s, workdayEnd: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <Section title="Pausa de almoço" hint="Aparece marcada no calendário, mas podes marcar serviços por cima.">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início">
                <input
                  type="time"
                  value={s.lunchStart}
                  onChange={(e) => setS({ ...s, lunchStart: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Fim">
                <input
                  type="time"
                  value={s.lunchEnd}
                  onChange={(e) => setS({ ...s, lunchEnd: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Cascata da lista de espera"
            hint="Quando cancelas uma marcação, é enviada uma mensagem ao primeiro cliente da lista de espera. Se não responder neste tempo, passa ao seguinte."
          >
            <Field label="Tempo de espera por resposta (minutos)">
              <input
                type="number"
                min={5}
                max={1440}
                value={s.cascadeWaitMinutes}
                onChange={(e) => setS({ ...s, cascadeWaitMinutes: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Lembretes" hint="Quantas horas antes da marcação enviar lembrete automático.">
            <Field label="Horas antes">
              <input
                type="number"
                min={1}
                max={168}
                value={s.reminderHoursBefore}
                onChange={(e) => setS({ ...s, reminderHoursBefore: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </Section>

          <Section title="Estado do WhatsApp">
            <div className={`rounded-md border p-3 text-sm ${
              s.whatsappMode === "real"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-blue-200 bg-blue-50 text-blue-900"
            }`}>
              <strong>Modo: {s.whatsappMode === "real" ? "REAL (Twilio)" : "MOCK (teste)"}</strong>
              <div className="mt-1 text-xs">
                {s.whatsappMode === "real"
                  ? "As mensagens estão a ser enviadas via Twilio para os números reais dos clientes."
                  : "As mensagens NÃO estão a ser enviadas — ficam guardadas em /mensagens para teste. Para enviar a sério, configura Twilio em .env e reinicia."}
              </div>
            </div>
          </Section>
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #D5D3CD;
          border-radius: 6px;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <h2 className="text-sm font-medium text-ink-800">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-ink-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-600">{label}</label>
      {children}
    </div>
  );
}
