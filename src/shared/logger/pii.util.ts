/**
 * Utilities for masking Personally Identifiable Information (PII)
 * such as phone numbers and email addresses in application logs.
 */

/**
 * Masks a phone number or WhatsApp chatId for safe logging.
 *
 * Examples:
 * - `6281234567890` -> `6281*******90`
 * - `081234567890` -> `0812******90`
 * - `+6281234567890` -> `+628********90`
 * - `6281234567890@c.us` -> `6281*******90@c.us`
 * - null / undefined / empty -> `***`
 */
export function maskPhone(phone?: string | null): string {
  if (!phone || typeof phone !== 'string') {
    return '***';
  }

  const trimmed = phone.trim();
  if (!trimmed) {
    return '***';
  }

  const atIndex = trimmed.indexOf('@');
  const numPart = atIndex !== -1 ? trimmed.slice(0, atIndex) : trimmed;
  const suffix = atIndex !== -1 ? trimmed.slice(atIndex) : '';

  if (numPart.length <= 4) {
    return '*'.repeat(numPart.length) + suffix;
  }

  if (numPart.length <= 7) {
    const prefix = numPart.slice(0, 2);
    const last = numPart.slice(-2);
    const maskLen = numPart.length - 4;
    return `${prefix}${'*'.repeat(maskLen)}${last}${suffix}`;
  }

  const prefix = numPart.slice(0, 4);
  const last = numPart.slice(-2);
  const maskLen = Math.max(3, numPart.length - 6);
  return `${prefix}${'*'.repeat(maskLen)}${last}${suffix}`;
}

/**
 * Masks an email address for safe logging.
 *
 * Examples:
 * - `user@example.com` -> `u***r@example.com`
 * - `a@example.com` -> `a***@example.com`
 * - null / undefined / invalid -> `***`
 */
export function maskEmail(email?: string | null): string {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '***';
  }

  const [local, ...domainParts] = email.split('@');
  const domain = domainParts.join('@');

  if (!local || !domain) {
    return '***';
  }

  if (local.length <= 1) {
    return `${local}***@${domain}`;
  }

  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
