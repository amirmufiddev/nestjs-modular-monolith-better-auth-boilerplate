import { renderEmailLayout } from '../components/email-layout';
import { renderEmailButton } from '../components/email-button';
import { createEmailTheme, EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import { escapeHtml } from '../utils/escape.util';
import type { EmailVerificationProps } from '../types';

export function buildEmailVerificationEmail(
  props: EmailVerificationProps,
  options?: { year?: number },
): string {
  const userName = escapeHtml(props.userName);
  const appName = escapeHtml(props.appName);
  const theme = createEmailTheme(props.appName);

  const buttonHtml = renderEmailButton({
    label: 'Verifikasi Email',
    href: props.verificationUrl,
    theme,
  });

  const bodyHtml = [
    `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Verifikasi Email Anda</h1>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Halo ${userName},</p>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Terima kasih telah mendaftar di ${appName}!</p>`,
    `<p style="margin:0 0 8px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Silakan verifikasi alamat email Anda dengan mengklik tombol di bawah:</p>`,
    buttonHtml,
  ].join('');

  return renderEmailLayout({
    title: `Verifikasi Email ${props.appName}`,
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
