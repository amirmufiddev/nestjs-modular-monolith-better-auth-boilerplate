/**
 * Standard Indonesian phone normalization:
 * - Strip spaces, dashes, parens, leading "+"
 * - Leading "0" → "62"
 * - Numbers already starting with "62" are kept as-is
 * - Anything else is returned cleaned of non-digits (used for non-ID phones)
 *
 * This is the single source of truth shared by every module so that
 * customer/supplier/organization/contact lookup stays consistent with WhatsApp's
 * `628xxx@c.us` chatId format.
 */
export function normalizePhone(
  input: string | null | undefined,
): string | null {
  if (!input) return null;
  const stripped = input.replace(/\s|-|\(|\)|\+/g, '').trim();
  if (!stripped) return null;
  const digits = stripped.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

export type WhatsappNumberResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: 'required' | 'invalid' };

/** Normalize a WhatsApp number. Empty is allowed only when not required. */
export function prepareWhatsappNumber(
  raw: unknown,
  required: boolean,
): WhatsappNumberResult {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return required
      ? { ok: false, reason: 'required' }
      : { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'invalid' };
  }
  const normalized = normalizePhone(raw);
  if (!normalized || normalized.length < 8 || normalized.length > 15) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, value: normalized };
}

/** Build canonical chatId for WAHA from a normalized phone. */
export function toWahaChatId(input: string | null | undefined): string | null {
  const normalized = normalizePhone(input);
  return normalized ? `${normalized}@c.us` : null;
}
