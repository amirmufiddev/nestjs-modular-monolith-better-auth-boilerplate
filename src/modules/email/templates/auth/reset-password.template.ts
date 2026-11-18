import { renderEmailLayout } from '../components/email-layout';
import { renderEmailButton } from '../components/email-button';
import { createEmailTheme, EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import { escapeHtml } from '../utils/escape.util';
import type { ResetPasswordProps } from '../types';

export function buildResetPasswordEmail(
  props: ResetPasswordProps,
  options?: { year?: number },
): string {
  const userName = escapeHtml(props.userName);
  const theme = createEmailTheme(props.appName);

  const buttonHtml = renderEmailButton({
    label: 'Reset Kata Sandi',
    href: props.resetUrl,
    theme,
  });

  const bodyHtml = [
    `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Reset Kata Sandi</h1>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Halo ${userName},</p>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Kami menerima permintaan untuk mereset kata sandi akun Anda. Silakan klik tombol di bawah ini untuk membuat kata sandi baru:</p>`,
    buttonHtml,
    `<p style="margin:24px 0 0 0;font-size:12px;line-height:1.5;color:${EMAIL_COLORS.textSecondary};font-family:${EMAIL_LAYOUT.fontFamily};">Jika Anda tidak meminta reset kata sandi, abaikan email ini. Tautan reset kata sandi ini akan kedaluwarsa secara otomatis demi keamanan akun Anda.</p>`,
  ].join('');

  return renderEmailLayout({
    title: `Reset Kata Sandi ${props.appName}`,
    header: {
      displayName: props.appName,
    },
    bodyHtml,
    footer: {
      senderName: props.appName,
      appName: props.appName,
    },
    year: options?.year,
  });
}
