import { escapeHtml } from '../utils/escape.util';
import { EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import type { EmailHeaderProps } from '../types';

export function renderEmailHeader(props: EmailHeaderProps): string {
  const displayName = escapeHtml(props.displayName);
  const logoBlock = props.logoUrl
    ? `<img src="${escapeHtml(props.logoUrl)}" alt="${displayName}" height="${EMAIL_LAYOUT.logoHeight}" style="display:block;margin:0 auto 8px auto;max-height:${EMAIL_LAYOUT.logoHeight}px;" />`
    : '';

  return [
    '<tr>',
    '<td align="center" style="padding:0 0 24px 0;">',
    logoBlock,
    `<p style="margin:0;font-size:18px;font-weight:700;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">${displayName}</p>`,
    '</td>',
    '</tr>',
  ].join('');
}
