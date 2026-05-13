import { ADDON_REGISTRY, type AddonKey } from "./addon-registry";

export const PLANS = { BASE: "BASE" } as const;
export type Plan = keyof typeof PLANS;
export type Addon = AddonKey;

export const PLAN_LABELS: Record<Plan, string> = { BASE: "Plano Base" };

export const PLAN_INCLUDES: Record<Plan, string[]> = {
  BASE: ["Marcações e calendário", "Notificações WhatsApp", "Lista de espera com cascata"],
};

/** Fallback labels — admin-edited names are served from DB at runtime. */
export const ADDON_LABELS = Object.fromEntries(
  ADDON_REGISTRY.map((a) => [a.key, a.defaultName])
) as Record<string, string>;

export function parseAddons(addonsJson: string): string[] {
  try { return JSON.parse(addonsJson) as string[]; } catch { return []; }
}

export function hasAddon(addonsJson: string, key: string): boolean {
  return parseAddons(addonsJson).includes(key);
}

export function serializeAddons(addons: string[]): string {
  return JSON.stringify(addons);
}
