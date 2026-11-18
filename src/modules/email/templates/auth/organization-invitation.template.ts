import { renderEmailLayout } from '../components/email-layout';
import { renderEmailButton } from '../components/email-button';
import { createEmailTheme, EMAIL_COLORS, EMAIL_LAYOUT } from '../theme';
import { escapeHtml } from '../utils/escape.util';
import { humanizeRole } from '../utils/role.util';
import { resolveAbsoluteAssetUrl } from '../utils/asset-url.util';
import type { OrganizationInvitationProps } from '../types';

const DEFAULT_ORGANIZATION_NAME = 'Organisasi';

export function buildOrganizationInvitationEmail(
  props: OrganizationInvitationProps,
  options?: { year?: number },
): string {
  const organizationName =
    props.organizationName?.trim() || DEFAULT_ORGANIZATION_NAME;
  const inviterName = escapeHtml(props.inviterName);
  const organizationNameEscaped = escapeHtml(organizationName);
  const appName = escapeHtml(props.appName);
  const roleLabel = escapeHtml(humanizeRole(props.role));
  const logoUrl = resolveAbsoluteAssetUrl(
    props.organizationLogo,
    props.baseUrl,
  );
  const theme = createEmailTheme(props.appName);

  const buttonHtml = renderEmailButton({
    label: 'Terima Undangan',
    href: props.inviteUrl,
    theme,
  });

  const bodyHtml = [
    `<h1 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Undangan Bergabung</h1>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">Halo,</p>`,
    `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${EMAIL_COLORS.textPrimary};font-family:${EMAIL_LAYOUT.fontFamily};">${inviterName} mengundang Anda untuk bergabung dengan organisasi &quot;${organizationNameEscaped}&quot; di ${appName} sebagai ${roleLabel}.</p>`,
    buttonHtml,
  ].join('');

  return renderEmailLayout({
    title: `Undangan Bergabung - ${organizationName}`,
    header: {
      displayName: organizationName,
      logoUrl,
    },
    bodyHtml,
    footer: {
      senderName: `${organizationName} via ${props.appName}`,
      appName: props.appName,
    },
    year: options?.year,
  });
}
