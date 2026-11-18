import { escapeHtml } from '../utils/escape.util';
import { EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import { isSafeHttpUrl } from '../utils/url.util';
import type { EmailButtonProps } from '../types';

export function renderEmailButton(props: EmailButtonProps): string {
  if (!isSafeHttpUrl(props.href)) {
    return '';
  }

  const label = escapeHtml(props.label);
  const href = escapeHtml(props.href);
  const primary = props.theme.primaryColor;

  return [
    '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">',
    '<tr>',
    `<td align="center" bgcolor="${primary}" style="border-radius:6px;">`,
    `<a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${EMAIL_LAYOUT.fontFamily};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:6px;background-color:${primary};">${label}</a>`,
    '</td>',
    '</tr>',
    '</table>',
    `<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textSecondary};word-break:break-all;font-family:${EMAIL_LAYOUT.fontFamily};">`,
    `Jika tombol tidak berfungsi, salin tautan berikut ke browser Anda:<br/>`,
    `<a href="${href}" style="color:${primary};">${href}</a>`,
    '</p>',
  ].join('');
}
