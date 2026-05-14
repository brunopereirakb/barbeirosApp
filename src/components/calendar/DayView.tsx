"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Cake, MessageCircle, Clock, Check, Coffee, CalendarClock, BarChart3, X, Calendar, LayoutDashboard } from "lucide-react";
import { cn, formatTime, durationLabel, addDays, timeStringToMinutes, isToday } from "@/lib/utils";
import { NewAppointmentModal } from "./NewAppointmentModal";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { RecurringAppointmentModal } from "./RecurringAppointmentModal";
import { MiniMonth } from "./MiniMonth";
import { DayNoteCard } from "./DayNoteCard";
import { SlotList } from "./SlotList";
import { ResizableSplit } from "./ResizableSplit";

type Appointment = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "done" | "cancelled" | "no_show";
  notes: string | null;
  client: { id: string; code: number | null; name: string; phone: string | null };
  service: { id: string; name: string; durationMin: number };
};

type Settings = {
  workdayStart: string;
  workdayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  cascadeWaitMinutes: number;
  defaultServiceByWeekday?: Record<string, string>;
  subscription?: { plan: string; addons: string[] };
};

type Service = { id: string; name: string; durationMin: number };

type WaitlistEntry = {
  id: string;
  preferences: string;
  client: { id: string; name: string };
  service: { id: string; name: string };
};

const PIXELS_PER_HOUR = 60; // 1 minuto = 1px

type CalView = "dashboard" | "day" | "week";

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  r.setHours(0, 0, 0, 0);
  return r;
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function DayView() {
  const [view, setView] = useState<CalView>("dashboard");
  const [date, setDate] = useState<Date>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [newAppointment, setNewAppointment] = useState<{ startsAt: Date } | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [now, setNow] = useState<Date>(new Date());
  const [birthdayClients, setBirthdayClients] = useState<{ id: string; name: string; customerSince: string }[]>([]);
  // Bumped each time `load()` runs successfully — passed to MiniMonth so its
  // own fetch (which covers the whole month) re-runs after a booking change.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const tick = async () => {
      try {
        await fetch("/api/cascade", { method: "POST", body: JSON.stringify({ action: "tick" }), headers: { "Content-Type": "application/json" } });
      } catch {}
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { void load(); }, [date, view]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      let apptRes: Appointment[];
      if (view === "week") {
        const monday = getMonday(date);
        const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
        apptRes = await fetch(
          `/api/appointments/search?dateFrom=${monday.toISOString()}&dateTo=${sunday.toISOString()}&limit=500`
        ).then((r) => r.ok ? r.json() : []).catch(() => []);
      } else {
        apptRes = await fetch(`/api/appointments?date=${date.toISOString()}`).then((r) => r.ok ? r.json() : []).catch(() => []);
      }

      const [setRes, wlRes, bdayRes, svcRes] = await Promise.all([
        fetch("/api/settings").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/waitlist").then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch("/api/clients").then((r) => r.ok ? r.json() : []).catch(() => []),
        fetch("/api/services").then((r) => r.ok ? r.json() : []).catch(() => []),
      ]);

      setAppointments(apptRes);
      if (setRes) setSettings(setRes);
      setWaitlist(wlRes);
      setServices(svcRes);
      setBirthdayClients(
        bdayRes.filter((c: { birthday: string | null }) => {
          if (!c.birthday) return false;
          const b = new Date(c.birthday);
          return b.getMonth() === date.getMonth() && b.getDate() === date.getDate();
        })
      );
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error("Calendar load error:", e);
    }
  }

  const dayStartMin = useMemo(() => timeStringToMinutes(settings?.workdayStart || "09:00"), [settings]);
  const dayEndMin = useMemo(() => timeStringToMinutes(settings?.workdayEnd || "19:00"), [settings]);
  const lunchStartMin = useMemo(() => timeStringToMinutes(settings?.lunchStart || "12:30"), [settings]);
  const lunchEndMin = useMemo(() => timeStringToMinutes(settings?.lunchEnd || "14:00"), [settings]);

  const totalMin = dayEndMin - dayStartMin;
  const hours = useMemo(() => {
    const arr: number[] = [];
    const startH = Math.floor(dayStartMin / 60);
    const endH = Math.ceil(dayEndMin / 60);
    for (let h = startH; h <= endH; h++) arr.push(h);
    return arr;
  }, [dayStartMin, dayEndMin]);

  function appointmentTop(a: Appointment): number {
    const start = new Date(a.startsAt);
    const min = start.getHours() * 60 + start.getMinutes();
    return ((min - dayStartMin) * PIXELS_PER_HOUR) / 60;
  }

  function appointmentHeight(a: Appointment): number {
    const start = new Date(a.startsAt);
    const end = new Date(a.endsAt);
    return ((end.getTime() - start.getTime()) / 60_000) * (PIXELS_PER_HOUR / 60);
  }

  // Linha do agora
  const showNowLine = isToday(date);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowTop = ((nowMin - dayStartMin) * PIXELS_PER_HOUR) / 60;

  // Stats laterais
  const visibleAppts = appointments.filter((a) => a.status !== "cancelled");
  const pendingCount = visibleAppts.filter((a) => a.status === "pending").length;
  const noShowCount = visibleAppts.filter((a) => a.status === "no_show").length;
  const totalScheduledMin = visibleAppts.reduce((sum, a) => {
    const dur = (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000;
    return sum + dur;
  }, 0);

  // Próxima/em curso
  const inProgress = visibleAppts.find((a) => {
    const start = new Date(a.startsAt).getTime();
    const end = new Date(a.endsAt).getTime();
    return now.getTime() >= start && now.getTime() < end && a.status !== "done";
  });

  // Click em slot vazio cria marcação naquele horário
  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minFromStart = Math.round((y / PIXELS_PER_HOUR) * 60);
    // Snap a 15min
    const snapped = Math.floor(minFromStart / 15) * 15;
    const totalMinutes = dayStartMin + snapped;
    const start = new Date(date);
    start.setHours(Math.floor(totalMinutes / 60), totalMinutes % 60, 0, 0);
    setNewAppointment({ startsAt: start });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-ink-200 bg-card px-3 py-2 sm:gap-2 sm:px-4 sm:py-2.5 overflow-hidden">
        {/* Prev */}
        <button
          onClick={() => setDate(view === "week" ? addDays(date, -7) : addDays(date, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
        >
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => setDate(new Date())} className="rounded-full border border-ink-300 bg-card px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50">
          Hoje
        </button>
        {/* Next */}
        <button
          onClick={() => setDate(view === "week" ? addDays(date, 7) : addDays(date, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-ink-100"
        >
          <ChevronRight size={18} />
        </button>

        {/* Date label */}
        <span className="min-w-0 shrink truncate px-0.5 text-xs font-medium text-ink-800 sm:px-2 sm:text-sm">
          {view === "week" ? (() => {
            const mon = getMonday(date);
            const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
            return `${mon.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })} – ${sun.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}`;
          })() : (
            <>
              <span className="sm:hidden">{date.toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}</span>
              <span className="hidden sm:inline">{date.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" })}</span>
            </>
          )}
        </span>

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-lg border border-ink-200 overflow-hidden">
          <button
            onClick={() => setView("dashboard")}
            className={cn("flex h-8 items-center gap-1 px-2.5 text-xs font-medium transition", view === "dashboard" ? "bg-brand-500 text-white" : "bg-card text-ink-600 hover:bg-ink-50")}
          >
            <LayoutDashboard size={13} />
            <span className="hidden sm:inline">Painel</span>
          </button>
          <button
            onClick={() => setView("day")}
            className={cn("flex h-8 items-center gap-1 border-l border-ink-200 px-2.5 text-xs font-medium transition", view === "day" ? "bg-brand-500 text-white" : "bg-card text-ink-600 hover:bg-ink-50")}
          >
            <Calendar size={13} />
            <span className="hidden sm:inline">Dia</span>
          </button>
          <button
            onClick={() => setView("week")}
            className={cn("flex h-8 items-center gap-1 border-l border-ink-200 px-2.5 text-xs font-medium transition", view === "week" ? "bg-brand-500 text-white" : "bg-card text-ink-600 hover:bg-ink-50")}
          >
            <CalendarClock size={13} />
            <span className="hidden sm:inline">Semana</span>
          </button>
        </div>

        <div className="flex-1 sm:hidden" />

        {/* Panel toggle — mobile only, day view only */}
        {view === "day" && (
          <button
            onClick={() => setShowPanel((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition md:hidden",
              showPanel ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-600 hover:bg-ink-50"
            )}
            aria-label="Resumo"
          >
            <BarChart3 size={14} />
            {visibleAppts.length > 0 && <span>{visibleAppts.length}</span>}
          </button>
        )}

        {/* Mobile: + with dropdown for new/recurring */}
        <NewAppointmentDropdown
          onNew={() => setNewAppointment({ startsAt: new Date(date) })}
          onRecurring={() => setShowRecurring(true)}
        />

        {/* Desktop: two separate buttons */}
        <button
          onClick={() => setNewAppointment({ startsAt: new Date(date) })}
          className="hidden items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-600 sm:flex"
        >
          <Plus size={16} /> Nova marcação
        </button>
        <button
          onClick={() => setShowRecurring(true)}
          className="hidden items-center gap-1.5 rounded-md border border-ink-300 px-3.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-50 sm:flex"
        >
          <CalendarClock size={16} /> Recorrente
        </button>
      </div>

      {/* Dashboard (main) — mini-month + notes | slots, divider is draggable on desktop */}
      {view === "dashboard" && (
        <ResizableSplit
          left={
            <>
              <MiniMonth
                selected={date}
                onSelectDay={setDate}
                settings={settings}
                services={services}
                refreshKey={refreshKey}
              />
              <DayNoteCard date={date} />
            </>
          }
          right={
            settings ? (
              <SlotList
                date={date}
                appointments={appointments}
                settings={settings}
                services={services}
                onCreateAt={(d) => setNewAppointment({ startsAt: d })}
                onSelectAppointment={setSelectedAppointment}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-ink-400">
                A carregar…
              </div>
            )
          }
        />
      )}

      {/* Week view */}
      {view === "week" && (
        <WeekGrid
          monday={getMonday(date)}
          appointments={appointments}
          onSelectAppointment={setSelectedAppointment}
          onNewAppointment={(d) => setNewAppointment({ startsAt: d })}
          now={now}
        />
      )}

      {/* Day view — flex-col on mobile, grid on desktop */}
      {view === "day" && <div className="flex flex-col flex-1 overflow-hidden md:grid" style={{ gridTemplateColumns: "1fr 240px" }}>
        {/* Calendário */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h1 className="text-lg font-medium text-ink-900">
              {date.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" })}
            </h1>
            <p className="text-xs text-ink-500">
              {visibleAppts.length} {visibleAppts.length === 1 ? "marcação" : "marcações"} · {Math.floor(totalScheduledMin / 60)}h
              {totalScheduledMin % 60 ? `${totalScheduledMin % 60}` : ""} agendado
            </p>
          </div>

          {/* Timeline */}
          <div className="relative" style={{ height: (totalMin * PIXELS_PER_HOUR) / 60 }}>
            {/* Faixa de almoço de fundo */}
            <div
              className="absolute left-12 right-2 rounded-sm bg-amber-50/60 border-y border-amber-200/50 pointer-events-none flex items-center justify-center"
              style={{
                top: ((lunchStartMin - dayStartMin) * PIXELS_PER_HOUR) / 60,
                height: ((lunchEndMin - lunchStartMin) * PIXELS_PER_HOUR) / 60,
              }}
            >
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700/70 uppercase tracking-wide">
                <Coffee size={12} /> Almoço
              </span>
            </div>

            {/* Linhas de hora (clicável para criar marcação) */}
            <div className="absolute inset-0" onClick={handleTimelineClick}>
              {hours.map((h, idx) => (
                <div
                  key={h}
                  className={cn(
                    "flex h-[60px] cursor-pointer hover:bg-brand-50/30 transition-colors",
                    idx > 0 && "border-t border-ink-100"
                  )}
                >
                  <div className="w-12 pt-0.5 text-[11px] text-ink-400">{h.toString().padStart(2, "0")}:00</div>
                  <div className="flex-1" />
                </div>
              ))}
            </div>

            {/* Marcações */}
            {appointments.map((a) => {
              if (a.status === "cancelled") return null;
              const top = appointmentTop(a);
              const height = appointmentHeight(a);
              const compact = height < 40;
              return (
                <div
                  key={a.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAppointment(a);
                  }}
                  className={cn(
                    "absolute left-12 right-2 cursor-pointer overflow-hidden rounded-md transition-shadow hover:shadow-md",
                    a.status === "confirmed" && "bg-brand-50 text-brand-800",
                    a.status === "pending" && "bg-amber-50 text-amber-900",
                    a.status === "done" && "bg-ink-100 text-ink-500",
                    a.status === "no_show" && "bg-red-50 text-red-800"
                  )}
                  style={{ top, height }}
                >
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px]",
                      a.status === "confirmed" && "bg-brand-500",
                      a.status === "pending" && "bg-amber-500",
                      a.status === "done" && "bg-ink-300",
                      a.status === "no_show" && "bg-red-500"
                    )}
                  />
                  {compact ? (
                    <div className="flex h-full items-center gap-1.5 overflow-hidden whitespace-nowrap pl-3 pr-2 text-xs">
                      {a.status === "done" && <Check size={11} />}
                      <span className="font-medium">{a.client.name}</span>
                      <span className="opacity-80">
                        · {a.service.name} · {formatTime(a.startsAt)}
                        {a.status === "pending" && " · pendente"}
                        {a.status === "no_show" && " · não veio"}
                      </span>
                    </div>
                  ) : (
                    <div className="px-3 py-1.5 pl-4">
                      <div className="text-sm font-medium leading-tight">{a.client.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
                        <Clock size={11} />
                        {formatTime(a.startsAt)} · {durationLabel(a.service.durationMin)} · {a.service.name}
                      </div>
                      {a.status === "confirmed" && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] opacity-80">
                          <MessageCircle size={11} /> Confirmada
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Linha do "agora" */}
            {showNowLine && nowTop >= 0 && nowTop <= (totalMin * PIXELS_PER_HOUR) / 60 && (
              <>
                <div
                  className="absolute left-0 z-20 -translate-y-2 rounded bg-card px-1 text-[11px] font-medium text-red-600"
                  style={{ top: nowTop }}
                >
                  {formatTime(now)}
                </div>
                <div
                  className="absolute z-20 h-2.5 w-2.5 -translate-y-1 rounded-full bg-red-600"
                  style={{ top: nowTop, left: 32 }}
                />
                <div
                  className="absolute left-9 right-0 z-10 border-t-[1.5px] border-red-600"
                  style={{ top: nowTop }}
                />
              </>
            )}
          </div>
        </div>

        {/* Painel direito — desktop only (mobile uses bottom sheet below) */}
        <div className="hidden md:block overflow-y-auto border-l border-ink-200 bg-card p-3">
          <div className="space-y-4">
            <section>
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                {isToday(date) ? "Hoje" : "Resumo"}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <Stat n={visibleAppts.length} label="marcações" />
                <Stat n={`${Math.floor(totalScheduledMin / 60)}h`} label="agendado" />
                <Stat n={pendingCount} label="pendentes" />
                <Stat n={noShowCount} label="não vieram" />
              </div>
            </section>

            {inProgress && (
              <section>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Em curso</p>
                <Card title={inProgress.client.name} subtitle={`Termina às ${formatTime(inProgress.endsAt)}`} onClick={() => setSelectedAppointment(inProgress)} />
              </section>
            )}

            {waitlist.length > 0 && (
              <section>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Lista de espera</p>
                <div className="space-y-1.5">
                  {waitlist.slice(0, 2).map((w) => {
                    const prefs = JSON.parse(w.preferences || "{}") as { notes?: string };
                    return (
                      <a
                        href="/lista-espera"
                        key={w.id}
                        className="block rounded-md border border-ink-200 bg-card p-2.5 hover:border-ink-300"
                      >
                        <div className="text-[13px] font-medium text-ink-800">{w.client.name}</div>
                        <div className="text-[11px] text-ink-500">
                          {w.service.name}
                          {prefs.notes ? ` · ${prefs.notes}` : ""}
                        </div>
                      </a>
                    );
                  })}
                  {waitlist.length > 2 && (
                    <a href="/lista-espera" className="block text-[11px] text-ink-500 hover:text-ink-700">
                      +{waitlist.length - 2} outros à espera
                    </a>
                  )}
                </div>
              </section>
            )}

            {birthdayClients.length > 0 && settings?.subscription?.addons?.includes("BIRTHDAY_WHATSAPP") && (
              <section>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Aniversário</p>
                {birthdayClients.map((c) => (
                  <BirthdayCard key={c.id} clientId={c.id} name={c.name} />
                ))}
              </section>
            )}
          </div>
        </div>
      </div>}

      {/* Mobile bottom sheet panel (day view only) */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setShowPanel(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-40 max-h-[65vh] overflow-y-auto rounded-t-2xl bg-card shadow-2xl md:hidden">
            <div className="sticky top-0 flex items-center justify-between border-b border-ink-100 bg-card px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Resumo do dia</span>
              <button onClick={() => setShowPanel(false)} className="rounded-md p-1 text-ink-400 hover:bg-ink-100">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <section>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">
                  {isToday(date) ? "Hoje" : "Resumo"}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  <Stat n={visibleAppts.length} label="marcações" />
                  <Stat n={`${Math.floor(totalScheduledMin / 60)}h`} label="agendado" />
                  <Stat n={pendingCount} label="pendentes" />
                  <Stat n={noShowCount} label="não vieram" />
                </div>
              </section>

              {inProgress && (
                <section>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Em curso</p>
                  <Card title={inProgress.client.name} subtitle={`Termina às ${formatTime(inProgress.endsAt)}`} onClick={() => { setSelectedAppointment(inProgress); setShowPanel(false); }} />
                </section>
              )}

              {waitlist.length > 0 && (
                <section>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Lista de espera ({waitlist.length})</p>
                  <div className="space-y-1.5">
                    {waitlist.slice(0, 3).map((w) => {
                      const prefs = JSON.parse(w.preferences || "{}") as { notes?: string };
                      return (
                        <a href="/lista-espera" key={w.id} onClick={() => setShowPanel(false)} className="block rounded-md border border-ink-200 bg-card p-2.5 hover:border-ink-300">
                          <div className="text-[13px] font-medium text-ink-800">{w.client.name}</div>
                          <div className="text-[11px] text-ink-500">{w.service.name}{prefs.notes ? ` · ${prefs.notes}` : ""}</div>
                        </a>
                      );
                    })}
                    {waitlist.length > 3 && <a href="/lista-espera" className="block text-[11px] text-ink-500">+{waitlist.length - 3} outros</a>}
                  </div>
                </section>
              )}

              {birthdayClients.length > 0 && settings?.subscription?.addons?.includes("BIRTHDAY_WHATSAPP") && (
                <section>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-ink-400">Aniversário</p>
                  {birthdayClients.map((c) => <BirthdayCard key={c.id} clientId={c.id} name={c.name} />)}
                </section>
              )}

              {/* Recurring shortcut on mobile */}
              <button
                onClick={() => { setShowPanel(false); setShowRecurring(true); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-200 py-2.5 text-sm text-ink-600 hover:bg-ink-50"
              >
                <CalendarClock size={16} /> Marcação recorrente
              </button>
            </div>
          </div>
        </>
      )}

      {newAppointment && (
        <NewAppointmentModal
          startsAt={newAppointment.startsAt}
          onClose={() => setNewAppointment(null)}
          onCreated={() => {
            setNewAppointment(null);
            void load();
          }}
        />
      )}

      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onChanged={() => {
            setSelectedAppointment(null);
            void load();
          }}
        />
      )}

      {showRecurring && (
        <RecurringAppointmentModal
          defaultDate={date}
          onClose={() => setShowRecurring(false)}
          onCreated={() => { setShowRecurring(false); void load(); }}
        />
      )}
    </div>
  );
}

const STATUS_COLORS_WEEK: Record<string, string> = {
  confirmed: "border-brand-300 bg-brand-50 text-brand-900",
  pending: "border-amber-300 bg-amber-50 text-amber-900",
  done: "border-ink-200 bg-ink-100 text-ink-500",
  no_show: "border-red-300 bg-red-50 text-red-800",
  cancelled: "border-ink-100 bg-card text-ink-400 line-through",
};

function WeekGrid({
  monday, appointments, onSelectAppointment, onNewAppointment, now,
}: {
  monday: Date;
  appointments: Appointment[];
  onSelectAppointment: (a: Appointment) => void;
  onNewAppointment: (d: Date) => void;
  now: Date;
}) {
  const days = getWeekDays(monday);

  function apptsByDay(d: Date) {
    return appointments
      .filter((a) => {
        if (a.status === "cancelled") return false;
        const s = new Date(a.startsAt);
        return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate();
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }

  function handleDayClick(d: Date) {
    const start = new Date(d);
    start.setHours(9, 0, 0, 0);
    onNewAppointment(start);
  }

  const todayStr = now.toDateString();

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Scrollable week grid */}
      <div className="flex flex-1 overflow-x-auto overflow-y-auto">
        <div className="flex min-w-[560px] flex-1 divide-x divide-ink-200">
          {days.map((day) => {
            const isToday = day.toDateString() === todayStr;
            const dayAppts = apptsByDay(day);
            return (
              <div key={day.toISOString()} className={cn("flex min-w-0 flex-1 flex-col", isToday && "bg-brand-50/30")}>
                {/* Day header */}
                <div className={cn(
                  "sticky top-0 z-10 flex flex-col items-center border-b px-2 py-2 text-center",
                  isToday ? "border-brand-200 bg-brand-50" : "border-ink-200 bg-card"
                )}>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    {day.toLocaleDateString("pt-PT", { weekday: "short" })}
                  </span>
                  <span className={cn(
                    "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday ? "bg-brand-500 text-white" : "text-ink-800"
                  )}>
                    {day.getDate()}
                  </span>
                </div>

                {/* Appointments */}
                <div
                  className="flex flex-1 cursor-pointer flex-col gap-1 p-1.5"
                  onClick={() => handleDayClick(day)}
                >
                  {dayAppts.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Plus size={14} className="text-ink-200" />
                    </div>
                  ) : (
                    dayAppts.map((a) => (
                      <button
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); onSelectAppointment(a); }}
                        className={cn(
                          "w-full rounded-md border p-1.5 text-left text-[11px] transition hover:shadow-sm",
                          STATUS_COLORS_WEEK[a.status] ?? ""
                        )}
                      >
                        <div className="truncate font-medium leading-tight">{a.client.name}</div>
                        <div className="truncate opacity-70">{formatTime(a.startsAt)}</div>
                        <div className="truncate opacity-70">{a.service.name}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NewAppointmentDropdown({ onNew, onRecurring }: { onNew: () => void; onRecurring: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative sm:hidden" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-white transition",
          open ? "bg-brand-600" : "bg-brand-500 hover:bg-brand-600"
        )}
        aria-label="Nova marcação"
      >
        <Plus size={18} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-ink-200 bg-card shadow-lg">
          <button
            onClick={() => { setOpen(false); onNew(); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-brand-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
              <Plus size={15} />
            </div>
            <div>
              <p className="font-medium text-ink-900">Nova marcação</p>
              <p className="text-xs text-ink-400">Marcação simples</p>
            </div>
          </button>
          <div className="mx-3 border-t border-ink-100" />
          <button
            onClick={() => { setOpen(false); onRecurring(); }}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-ink-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
              <CalendarClock size={15} />
            </div>
            <div>
              <p className="font-medium text-ink-900">Marcação recorrente</p>
              <p className="text-xs text-ink-400">Repetir automaticamente</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-md border border-ink-200 bg-card px-2.5 py-2">
      <div className="text-lg font-medium leading-none text-ink-900">{n}</div>
      <div className="mt-1 text-[11px] text-ink-500">{label}</div>
    </div>
  );
}

function Card({ title, subtitle, onClick }: { title: string; subtitle: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-md border border-ink-200 bg-card p-2.5 text-left hover:border-ink-300"
    >
      <div className="text-[13px] font-medium text-ink-800">{title}</div>
      <div className="text-[11px] text-ink-500">{subtitle}</div>
    </button>
  );
}

function BirthdayCard({ clientId, name }: { clientId: string; name: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setSending(true);
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "birthday", clientId }),
      });
      const data = await r.json();
      if (data.ok) setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-md border border-pink-200 bg-pink-50 p-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-pink-900">
        <Cake size={13} /> {name}
      </div>
      <button
        onClick={send}
        disabled={sending || sent}
        className="mt-2 rounded-md bg-pink-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-pink-700 disabled:opacity-60"
      >
        {sent ? "✓ Mensagem enviada" : sending ? "A enviar..." : "Enviar parabéns"}
      </button>
    </div>
  );
}
