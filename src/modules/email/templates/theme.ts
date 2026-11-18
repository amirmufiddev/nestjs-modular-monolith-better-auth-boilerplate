export const EMAIL_COLORS = {
  primary: '#0066CC',
  primaryDark: '#004C99',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  background: '#F3F4F6',
  cardBg: '#FFFFFF',
  border: '#E5E7EB',
} as const;

export const EMAIL_LAYOUT = {
  maxWidth: 600,
  cardPadding: 32,
  logoHeight: 48,
  fontFamily: 'Arial, Helvetica, sans-serif',
} as const;

export function createEmailTheme(appName: string) {
  return {
    primaryColor: EMAIL_COLORS.primary,
    appName,
  };
}
