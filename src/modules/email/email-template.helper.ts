import { escapeHtml } from './templates/utils/escape.util';

export { escapeHtml };

/**
 * Humanize template key (kebab-case) menjadi Title Case untuk subject/default title.
 * Contoh: "email-verification" => "Email Verification".
 */
export function humanizeTemplateKey(templateKey: string): string {
  return templateKey
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Resolve subject email berdasarkan templateKey. Override `subject` dari caller
 * selalu dipakai bila ada; selain itu dipakai humanizeTemplateKey.
 */
export function resolveSubject(
  templateKey: string,
  prefix: string,
  override?: string,
): string {
  const title = override ?? humanizeTemplateKey(templateKey);
  return prefix ? `${prefix} ${title}` : title;
}

/**
 * Bungkus body plain-text (hasil render TemplateService) menjadi HTML email
 * yang rapi. Output selalu di-escape untuk mencegah HTML/script injection
 * dari data dinamis.
 *
 * @deprecated Use template builders from `@/modules/email/templates` instead.
 */
export function wrapAsHtml(
  plainText: string,
  options: { title?: string; orgName?: string } = {},
): string {
  const title = escapeHtml(options.title ?? 'Notifikasi MyApp');
  const orgName = escapeHtml(options.orgName ?? 'MyApp');
  const escapedBody = escapeHtml(plainText);
  const htmlBody = escapedBody.replace(/\r?\n/g, '<br/>');

  return [
    '<!DOCTYPE html>',
    '<html lang="id">',
    '<head>',
    '<meta charset="utf-8" />',
    `<title>${title}</title>`,
    '</head>',
    '<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5e7eb;">',
    `<h1 style="margin:0 0 16px 0;font-size:18px;color:#111827;">${title}</h1>`,
    `<div style="font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;">${htmlBody}</div>`,
    '<hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />',
    `<p style="margin:0;font-size:12px;color:#6b7280;">Email otomatis dari ${orgName}. Mohon tidak membalas email ini.</p>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * Validasi email address (RFC-lite). Hanya dipakai untuk sanity check sebelum
 * enqueue; provider SMTP akan melakukan validasi final.
 */
export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
