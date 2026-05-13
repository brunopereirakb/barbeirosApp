"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Plus, Search, Phone, Mail, Cake, MessageCircle } from "lucide-react";

type Client = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  notes: string | null;
  customerSince: string;
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  async function load() {
    const data = await fetch(`/api/clients${search ? `?q=${encodeURIComponent(search)}` : ""}`).then((r) => r.json());
    setClients(data);
  }

  useEffect(() => {
    void load();
  }, [search]);

  return (
    <div className="h-full">
      <div className="flex items-center gap-3 border-b border-ink-200 bg-white px-5 py-3">
        <h1 className="text-lg font-medium text-ink-900">Clientes</h1>
        <span className="text-xs text-ink-500">{clients.length}</span>
        <div className="flex-1" />
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome, telefone..."
            className="w-72 rounded-md border border-ink-300 py-1.5 pl-8 pr-3 text-sm"
          />
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus size={16} /> Novo cliente
        </Button>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => setEditing(c)}
              className="rounded-lg border border-ink-200 bg-white p-3 text-left transition-colors hover:border-ink-300"
            >
              <div className="font-medium text-ink-900">{c.name}</div>
              <div className="mt-1 space-y-0.5 text-xs text-ink-500">
                {c.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={11} /> {c.phone}
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-1">
                    <Mail size={11} /> {c.email}
                  </div>
                )}
                {c.birthday && (
                  <div className="flex items-center gap-1">
                    <Cake size={11} /> {new Date(c.birthday).toLocaleDateString("pt-PT", { day: "numeric", month: "long" })}
                  </div>
                )}
              </div>
              {c.notes && <div className="mt-2 line-clamp-2 text-xs text-ink-600">{c.notes}</div>}
            </button>
          ))}
        </div>
        {clients.length === 0 && (
          <div className="py-12 text-center text-sm text-ink-500">Nenhum cliente encontrado.</div>
        )}
      </div>

      {showNew && <ClientForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); void load(); }} />}
      {editing && (
        <ClientForm
          client={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ClientForm({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [email, setEmail] = useState(client?.email || "");
  const [birthday, setBirthday] = useState(client?.birthday ? client.birthday.substring(0, 10) : "");
  const [notes, setNotes] = useState(client?.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const data = { name, phone: phone || null, email: email || null, birthday: birthday || null, notes: notes || null };
      if (client) {
        await fetch(`/api/clients/${client.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/clients", {
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

  async function sendBirthday() {
    if (!client) return;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "birthday", clientId: client.id }),
    });
    alert("Mensagem enviada (vê em /mensagens)");
  }

  return (
    <Modal open onClose={onClose} title={client ? "Editar cliente" : "Novo cliente"}>
      <div className="space-y-3">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </Field>
        <Field label="Telefone (com indicativo, ex: +351912...)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" />
        </Field>
        <Field label="Data de nascimento">
          <input value={birthday} onChange={(e) => setBirthday(e.target.value)} type="date" className="input" />
        </Field>
        <Field label="Notas">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="Alergias, preferências, fórmulas de cor..." />
        </Field>

        <div className="flex justify-between gap-2 border-t border-ink-200 pt-3">
          {client && client.phone && (
            <Button variant="ghost" size="sm" onClick={sendBirthday}>
              <MessageCircle size={14} /> Enviar parabéns
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? "A guardar..." : "Guardar"}
            </Button>
          </div>
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
        .input:focus {
          outline: 2px solid #1D9E75;
          outline-offset: 0;
          border-color: transparent;
        }
      `}</style>
    </Modal>
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
