/**
 * ADDON REGISTRY — single source of truth for all available addons.
 *
 * Each addon here has REAL code behind it. Adding an entry to this list
 * is NOT enough — you must also implement the feature and gate it with
 * hasAddon(). See the `implementedIn` field for where each feature lives.
 *
 * How to add a new addon:
 *  1. Add an entry to ADDON_REGISTRY below.
 *  2. Implement the feature in the relevant page/component.
 *  3. Gate it with: if (!hasAddon(subscription.addons, "YOUR_KEY")) return null
 *  4. The admin panel will auto-discover the new entry on next load.
 */

export interface AddonEntry {
  key: string;
  defaultName: string;
  defaultDescription: string;
  defaultPrice: number;
  /** File path (relative to src/) where the feature is implemented. */
  implementedIn: string;
}

export const ADDON_REGISTRY: readonly AddonEntry[] = [
  {
    key: "BIRTHDAY_WHATSAPP",
    defaultName: "Parabéns via WhatsApp",
    defaultDescription: "Envia mensagem de parabéns automática no aniversário do cliente via WhatsApp",
    defaultPrice: 2.99,
    implementedIn: "components/calendar/DayView.tsx → BirthdayCard",
  },
  {
    key: "EMAIL_NOTIFICATIONS",
    defaultName: "Notificações por Email",
    defaultDescription: "Envia confirmações e lembretes de marcações por email",
    defaultPrice: 1.99,
    implementedIn: "lib/whatsapp.ts → sendEmail (a implementar)",
  },
  {
    key: "SMS_NOTIFICATIONS",
    defaultName: "Notificações por SMS",
    defaultDescription: "Envia confirmações e lembretes de marcações por SMS",
    defaultPrice: 3.99,
    implementedIn: "lib/whatsapp.ts → sendSms (a implementar)",
  },
] as const;

export type AddonKey = typeof ADDON_REGISTRY[number]["key"];

/** Returns default metadata for a given key, or undefined if not in registry. */
export function getAddonDefaults(key: string): AddonEntry | undefined {
  return ADDON_REGISTRY.find((a) => a.key === key);
}
