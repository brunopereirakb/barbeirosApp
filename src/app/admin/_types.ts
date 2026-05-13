export interface UserRow {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: string;
  subscription: {
    plan: string;
    addons: string[];
    status: "active" | "trial" | "paused" | "expired" | "cancelled";
    trialEndsAt: string | null;
    expiresAt: string | null;
    renewalType: "monthly" | "annual" | "manual";
    paymentStatus: "paid" | "pending" | "overdue";
    notes: string | null;
    createdAt: string;
  };
}

export interface PlanDef {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price: number;
  features: string[];
  active: boolean;
}

export interface AddonDef {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  implementedIn: string;
}

export const STATUS_LABELS: Record<UserRow["subscription"]["status"], string> = {
  active: "Ativo",
  trial: "Trial",
  paused: "Pausado",
  expired: "Expirado",
  cancelled: "Cancelado",
};

export const STATUS_COLORS: Record<UserRow["subscription"]["status"], string> = {
  active: "bg-green-50 text-green-700",
  trial: "bg-blue-50 text-blue-700",
  paused: "bg-yellow-50 text-yellow-700",
  expired: "bg-red-50 text-red-600",
  cancelled: "bg-ink-100 text-ink-500",
};

export const PAYMENT_LABELS: Record<UserRow["subscription"]["paymentStatus"], string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Em atraso",
};

export const PAYMENT_COLORS: Record<UserRow["subscription"]["paymentStatus"], string> = {
  paid: "bg-green-50 text-green-700",
  pending: "bg-yellow-50 text-yellow-700",
  overdue: "bg-red-50 text-red-600",
};

export const RENEWAL_LABELS: Record<UserRow["subscription"]["renewalType"], string> = {
  monthly: "Mensal",
  annual: "Anual",
  manual: "Manual",
};
