// UI-only helpers for masking reporter details on screen.

/** Mask a phone number keeping only the last 3 digits, e.g. 0712345456 -> 07XX XXX 456, +254712345456 -> +2547XX XXX 456 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return raw.length > 3 ? "XXX" + raw.slice(-3) : raw;
  const last3 = digits.slice(-3);
  if (raw.startsWith("+") || digits.startsWith("254")) return `+${digits.slice(0, 4)}XX XXX ${last3}`;
  return `${digits.slice(0, 2)}XX XXX ${last3}`;
}

/** First name + last initial ("Wanjiku M."), or initials if only one token is long. */
export function shortName(name?: string | null): string {
  if (!name) return "Anonymous";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Anonymous";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const PRIVACY_NOTE = "Reporter details masked for privacy";
