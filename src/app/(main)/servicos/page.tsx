"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Plus, Trash2, Clock } from "lucide-react";
import { durationLabel } from "@/lib/utils";

type Service = {
  id: string;
  name: string;
  durationMin: number;
  category: string | null;
  active: boolean;
};

const CATEGORIES = [
  { id: "corte", label: "Cortes" },
  { id: "coloracao", label: "Coloração" },
  { id: "barba", label: "Barba" },
  { id: "rapido", label: "Serviços rápidos" },
  { id: "outros", label: "Outros" },
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const data = await fetch("/api/services").then((r) => r.json());
    setServices(data);
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Remover este serviço?")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Serviços</h1>
        <span className="text-xs text-ink-500">{services.length}</span>
        <div className="flex-1" />
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Novo serviço
        </Button>
      </div>

      <div className="p-5">
        {CATEGORIES.map((cat) => {
          const list = services.filter((s) => (s.category || "outros") === cat.id);
          if (list.length === 0) return null;
          return (
            <div key={cat.id} className="mb-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-500">{cat.label}</h2>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-ink-200 bg-white p-3"
                  >
                    <div onClick={() => setEditing(s)} className="cursor-pointer flex-1">
                      <div className="font-medium text-ink-900">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                        <Clock size={11} /> {durationLabel(s.durationMin)}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(s.id)}
                      className="rounded-md p-2 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remover"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {services.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-500">Ainda não tens serviços. Cria o primeiro.</div>
        )}
      </div>

      {(showNew || editing) && (
        <ServiceForm
          service={editing || undefined}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ServiceForm({ service, onClose, onSaved }: { service?: Service; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(service?.name || "");
  const [durationMin, setDurationMin] = useState(service?.durationMin || 30);
  const [category, setCategory] = useState(service?.category || "corte");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const data = { name, durationMin, category };
      if (service) {
        await fetch(`/api/services/${service.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={service ? "Editar serviço" : "Novo serviço"}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Corte mulher"
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Duração (minutos)</label>
          <input
            type="number"
            min={5}
            step={5}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-600">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-ink-300 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-200 pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            {saving ? "A guardar..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
