import { escapeHtml } from '../utils/escape.util';
import { EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import { renderEmailHeader } from './email-header';
import { renderEmailFooter } from './email-footer';
import type { EmailLayoutProps } from '../types';

export function renderEmailLayout(props: EmailLayoutProps): string {
  const title = escapeHtml(props.title);

  return [
    '<!DOCTYPE html>',
    '<html lang="id">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `<title>${title}</title>`,
    '</head>',
    `<body style="margin:0;padding:24px;background:${EMAIL_COLORS.background};font-family:${EMAIL_LAYOUT.fontFamily};color:${EMAIL_COLORS.textPrimary};">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${EMAIL_COLORS.background};">`,
    '<tr>',
    '<td align="center">',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:${EMAIL_LAYOUT.maxWidth}px;background:${EMAIL_COLORS.cardBg};border:1px solid ${EMAIL_COLORS.border};border-radius:8px;">`,
    '<tr>',
    `<td style="padding:${EMAIL_LAYOUT.cardPadding}px;">`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">',
    renderEmailHeader(props.header),
    '<tr>',
    '<td style="padding:0;">',
    props.bodyHtml,
    '</td>',
    '</tr>',
    renderEmailFooter(
      props.year !== undefined
        ? { ...props.footer, year: props.year }
        : props.footer,
    ),
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\n');
}
