export interface EmailTheme {
  primaryColor: string;
  appName: string;
}

export interface EmailHeaderProps {
  displayName: string;
  logoUrl?: string;
}

export interface EmailButtonProps {
  label: string;
  href: string;
  theme: EmailTheme;
}

export interface EmailFooterProps {
  senderName: string;
  appName: string;
  year?: number;
}

export interface EmailLayoutProps {
  title: string;
  header: EmailHeaderProps;
  bodyHtml: string;
  footer: EmailFooterProps;
  /**
   * Optional copyright year forwarded to the footer. Defaults to the current
   * year when omitted; callers should inject a fixed year in snapshot tests
   * to keep them deterministic.
   */
  year?: number;
}

export interface ResetPasswordProps {
  userName: string;
  resetUrl: string;
  appName: string;
}

export interface EmailVerificationProps {
  userName: string;
  verificationUrl: string;
  appName: string;
}

export interface OrganizationInvitationProps {
  inviterName: string;
  organizationName: string;
  organizationLogo?: string | null;
  role: string;
  inviteUrl: string;
  appName: string;
  baseUrl: string;
}
