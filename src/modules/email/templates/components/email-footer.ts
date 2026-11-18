import { escapeHtml } from '../utils/escape.util';
import { EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import type { EmailFooterProps } from '../types';

export function renderEmailFooter(props: EmailFooterProps): string {
  const senderName = escapeHtml(props.senderName);
  const appName = escapeHtml(props.appName);
  const year = props.year ?? new Date().getFullYear();

  return [
    '<tr>',
    `<td style="padding:24px 0 0 0;border-top:1px solid ${EMAIL_COLORS.border};">`,
    `<p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textSecondary};font-family:${EMAIL_LAYOUT.fontFamily};">`,
    `Email otomatis dari ${senderName}. Mohon tidak membalas email ini.`,
    '</p>',
    `<p style="margin:0;font-size:12px;color:${EMAIL_COLORS.textSecondary};font-family:${EMAIL_LAYOUT.fontFamily};">`,
    `© ${year} ${appName}`,
    '</p>',
    '</td>',
    '</tr>',
  ].join('');
}
