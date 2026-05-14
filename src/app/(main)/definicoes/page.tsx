"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ServiceSearchSelect } from "@/components/ui/ServiceSearchSelect";
import { Save, ChevronDown, Plus, X } from "lucide-react";

type Service = { id: string; name: string; durationMin: number };

type WorkEntry = { closed: boolean; start: string; end: string };

type ServiceWindowEntry = { start: string; end: string; serviceId: string };

type Settings = {
  salonName: string;
  timezone: string;
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  cascadeWaitMinutes: number;
  reminderHoursBefore: number;
  reminderTemplate: string | null;
  whatsappMode: string;
  defaultServiceByWeekday: Record<string, string>;
  defaultServiceWindowsByWeekday: Record<string, ServiceWindowEntry[]>;
  workScheduleByWeekday: Record<string, WorkEntry>;
};

const DEFAULT_REMINDER_TEMPLATE = `Olá {cliente}! 👋

Lembrete da sua marcação no {salao}:
📅 {data}
🕐 {hora}
✂️ {servico}

Se precisar de remarcar, responda a esta mensagem. Até amanhã!`;

const TIMEZONE_OPTIONS = [
  "Europe/Lisbon",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Zurich",
  "Atlantic/Madeira",
  "Atlantic/Azores",
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
// Display Mon..Sun in the UI (matches Portuguese week order) but the data keys remain 0=Sun..6=Sat.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function buildInitialSchedule(
  raw: Record<string, { closed?: boolean; start?: string; end?: string }> | undefined,
  globalStart: string,
  globalEnd: string
): Record<string, WorkEntry> {
  const out: Record<string, WorkEntry> = {};
  for (let i = 0; i < 7; i++) {
    const key = String(i);
    const e = raw?.[key];
    out[key] = {
      closed: !!e?.closed,
      start: e?.start || globalStart,
      end: e?.end || globalEnd,
    };
  }
  return out;
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings & { workScheduleByWeekday?: Record<string, { closed?: boolean; start?: string; end?: string }> }) => {
        setS({
          ...data,
          defaultServiceByWeekday: data.defaultServiceByWeekday ?? {},
          defaultServiceWindowsByWeekday: data.defaultServiceWindowsByWeekday ?? {},
          workScheduleByWeekday: buildInitialSchedule(
            data.workScheduleByWeekday,
            data.workdayStart,
            data.workdayEnd
          ),
        });
      });
    void fetch("/api/services").then((r) => r.json()).then(setServices);
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
      <div className="flex items-center gap-3 border-b border-ink-200 bg-card px-5 py-3">
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
            <Field label="Fuso horário">
              <select
                value={s.timezone || "Europe/Lisbon"}
                onChange={(e) => setS({ ...s, timezone: e.target.value })}
                className="input"
              >
                {(TIMEZONE_OPTIONS.includes(s.timezone)
                  ? TIMEZONE_OPTIONS
                  : [s.timezone, ...TIMEZONE_OPTIONS]
                ).map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          <Section
            title="Horário e dias de trabalho"
            hint="Define que dias estás aberto e a que horas. Os dias marcados como fechados aparecem a vermelho no calendário."
          >
            <div className="space-y-2">
              {WEEKDAY_ORDER.map((dow) => {
                const key = String(dow);
                const entry = s.workScheduleByWeekday[key] ?? { closed: false, start: s.workdayStart, end: s.workdayEnd };
                const isOpen = !entry.closed;
                return (
                  <div key={dow} className="flex flex-wrap items-center gap-3">
                    <span className="w-20 shrink-0 text-xs font-medium text-ink-700">
                      {WEEKDAY_NAMES[dow]}
                    </span>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-ink-700">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => {
                          const next = { ...s.workScheduleByWeekday };
                          next[key] = { ...entry, closed: !e.target.checked };
                          setS({ ...s, workScheduleByWeekday: next });
                        }}
                        className="h-4 w-4 rounded border-ink-300"
                      />
                      {isOpen ? "Aberto" : "Fechado"}
                    </label>
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="time"
                        value={entry.start}
                        disabled={!isOpen}
                        onChange={(e) => {
                          const next = { ...s.workScheduleByWeekday };
                          next[key] = { ...entry, start: e.target.value };
                          setS({ ...s, workScheduleByWeekday: next });
                        }}
                        className="input flex-1 disabled:bg-ink-50 disabled:text-ink-400"
                      />
                      <span className="text-xs text-ink-400">–</span>
                      <input
                        type="time"
                        value={entry.end}
                        disabled={!isOpen}
                        onChange={(e) => {
                          const next = { ...s.workScheduleByWeekday };
                          next[key] = { ...entry, end: e.target.value };
                          setS({ ...s, workScheduleByWeekday: next });
                        }}
                        className="input flex-1 disabled:bg-ink-50 disabled:text-ink-400"
                      />
                    </div>
                  </div>
                );
              })}
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
            title="Serviço padrão por dia da semana"
            hint="Define o serviço habitual de cada dia. A duração desse serviço determina o tamanho dos slots no painel diário (ex.: corte de 15 min nos dias de semana, 10 min ao fim de semana). Alterar o serviço padrão NÃO muda as marcações já existentes — apenas a grelha do calendário e o número de slots disponíveis. Se mudares para um serviço mais longo, as contagens livre/ocupado podem parecer diferentes até as marcações antigas terminarem."
          >
            <div className="space-y-2">
              {WEEKDAY_ORDER.map((dow) => {
                const key = String(dow);
                const value = s.defaultServiceByWeekday[key] ?? "";
                const windows = s.defaultServiceWindowsByWeekday[key] ?? [];
                const hasWindows = windows.length > 0;
                return (
                  <DayServiceRow
                    key={dow}
                    name={WEEKDAY_NAMES[dow]}
                    weekdayKey={key}
                    weekdayHours={s.workScheduleByWeekday[key]}
                    fallbackStart={s.workdayStart}
                    fallbackEnd={s.workdayEnd}
                    services={services}
                    singleValue={value}
                    onSingleChange={(svcId) => {
                      const next = { ...s.defaultServiceByWeekday };
                      if (svcId) next[key] = svcId;
                      else delete next[key];
                      setS({ ...s, defaultServiceByWeekday: next });
                    }}
                    windows={windows}
                    onWindowsChange={(updated) => {
                      const next = { ...s.defaultServiceWindowsByWeekday };
                      if (updated.length === 0) delete next[key];
                      else next[key] = updated;
                      setS({ ...s, defaultServiceWindowsByWeekday: next });
                    }}
                    hasWindows={hasWindows}
                  />
                );
              })}
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

          <Section title="Lembretes" hint="Quantas horas antes da marcação enviar lembrete automático, e mensagem usada.">
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
            <Field label="Mensagem do lembrete">
              <textarea
                value={s.reminderTemplate ?? ""}
                onChange={(e) =>
                  setS({ ...s, reminderTemplate: e.target.value === "" ? null : e.target.value })
                }
                rows={8}
                placeholder={DEFAULT_REMINDER_TEMPLATE}
                className="input font-mono text-xs leading-relaxed"
              />
              <p className="mt-1 text-[11px] text-ink-500">
                Substituídos automaticamente:{" "}
                <code className="rounded bg-ink-100 px-1">{"{cliente}"}</code>{" "}
                <code className="rounded bg-ink-100 px-1">{"{servico}"}</code>{" "}
                <code className="rounded bg-ink-100 px-1">{"{hora}"}</code>{" "}
                <code className="rounded bg-ink-100 px-1">{"{data}"}</code>{" "}
                <code className="rounded bg-ink-100 px-1">{"{salao}"}</code>. Deixa em branco para usar
                o template por defeito.
              </p>
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
    <div className="rounded-lg border border-ink-200 bg-card p-4">
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

/**
 * One weekday row in "Serviço padrão por dia da semana" — shows the simple
 * single-service select by default. Under "Avançado" you can split the day
 * into time windows that each use their own service (the rare case the user
 * asked us to keep tucked away).
 */
function DayServiceRow({
  name,
  weekdayKey,
  weekdayHours,
  fallbackStart,
  fallbackEnd,
  services,
  singleValue,
  onSingleChange,
  windows,
  onWindowsChange,
  hasWindows,
}: {
  name: string;
  weekdayKey: string;
  weekdayHours?: WorkEntry;
  fallbackStart: string;
  fallbackEnd: string;
  services: Service[];
  singleValue: string;
  onSingleChange: (id: string) => void;
  windows: ServiceWindowEntry[];
  onWindowsChange: (next: ServiceWindowEntry[]) => void;
  hasWindows: boolean;
}) {
  const [open, setOpen] = useState(hasWindows);
  const dayStart = weekdayHours?.start || fallbackStart;
  const dayEnd = weekdayHours?.end || fallbackEnd;

  function addWindow() {
    // Default: pick up where the last window ended (or dayStart) and run
    // until dayEnd, with the first available service.
    const lastEnd = windows.length > 0 ? windows[windows.length - 1].end : dayStart;
    const next: ServiceWindowEntry = {
      start: lastEnd,
      end: dayEnd,
      serviceId: singleValue || services[0]?.id || "",
    };
    onWindowsChange([...windows, next]);
  }
  function updateWindow(idx: number, patch: Partial<ServiceWindowEntry>) {
    onWindowsChange(windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }
  function removeWindow(idx: number) {
    onWindowsChange(windows.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="w-20 shrink-0 text-xs font-medium text-ink-700">{name}</span>
        <ServiceSearchSelect
          services={services}
          value={singleValue}
          onChange={onSingleChange}
          allowEmpty
          emptyLabel="— sem serviço padrão —"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
            hasWindows
              ? "border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
              : "border border-ink-200 text-ink-500 hover:bg-ink-50"
          }`}
          title="Aplicar serviços diferentes a horários do mesmo dia"
        >
          Avançado
          <ChevronDown
            size={11}
            className={`transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="ml-[5.75rem] rounded-md border border-ink-200 bg-ink-50/40 p-2.5">
          <p className="mb-2 text-[11px] text-ink-500">
            Aplicar serviços diferentes em horários do mesmo dia. Cada
            período usa a duração desse serviço como tamanho de slot.{" "}
            <span className="font-medium text-ink-600">
              O resto do horário ({dayStart}–{dayEnd}) usa o serviço padrão
              acima.
            </span>
          </p>
          {windows.length === 0 ? (
            <p className="text-[11px] text-ink-400">
              Sem períodos configurados — todo o dia usa o serviço padrão
              acima.
            </p>
          ) : (
            <div className="space-y-1.5">
              {windows.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) => updateWindow(i, { start: e.target.value })}
                    className="input w-24 px-2 py-1 text-xs"
                  />
                  <span className="text-[11px] text-ink-400">–</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => updateWindow(i, { end: e.target.value })}
                    className="input w-24 px-2 py-1 text-xs"
                  />
                  <ServiceSearchSelect
                    services={services}
                    value={w.serviceId}
                    onChange={(id) => updateWindow(i, { serviceId: id })}
                    placeholder="Escolher serviço"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeWindow(i)}
                    title="Remover período"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-red-100 hover:text-red-600"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={addWindow}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-ink-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-brand-400 hover:text-brand-700"
          >
            <Plus size={11} /> Adicionar período
          </button>
        </div>
      )}
    </div>
  );
}
