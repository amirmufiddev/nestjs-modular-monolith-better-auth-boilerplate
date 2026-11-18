import { buildResetPasswordEmail } from './reset-password.template';
import type { ResetPasswordProps } from '../../types';

describe('buildResetPasswordEmail', () => {
  const defaultProps: ResetPasswordProps = {
    userName: 'Budi Santoso',
    resetUrl: 'https://example.com/reset-password?token=abc123xyz',
    appName: 'MyApp',
  };

  it('should generate email layout with proper title', () => {
    const html = buildResetPasswordEmail(defaultProps);
    expect(html).toContain('<title>Reset Kata Sandi MyApp</title>');
  });

  it('should render heading, salutation, reset message, CTA button, and security disclaimer', () => {
    const html = buildResetPasswordEmail(defaultProps);

    // Heading & Salutation
    expect(html).toContain('Reset Kata Sandi');
    expect(html).toContain('Halo Budi Santoso,');

    // Message about reset request
    expect(html).toContain(
      'Kami menerima permintaan untuk mereset kata sandi akun Anda.',
    );

    // CTA Button with resetUrl
    expect(html).toContain(
      'href="https://example.com/reset-password?token=abc123xyz"',
    );
    expect(html).toContain('Reset Kata Sandi');

    // Security disclaimer
    expect(html).toContain(
      'Jika Anda tidak meminta reset kata sandi, abaikan email ini',
    );
  });

  it('should escape userName and appName to prevent XSS', () => {
    const maliciousProps: ResetPasswordProps = {
      userName: '<script>alert("xss")</script>',
      resetUrl: 'https://example.com/reset-password?token=safe',
      appName: '<b>Acme & Co</b>',
    };

    const html = buildResetPasswordEmail(maliciousProps);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );

    expect(html).not.toContain('<b>Acme & Co</b>');
    expect(html).toContain('&lt;b&gt;Acme &amp; Co&lt;/b&gt;');
  });

  // The builder does not fall back userName itself; the caller (auth.ts) is
  // expected to coerce null/undefined to 'Pengguna' before invoking the
  // builder. We assert the current behavior here so the contract is clear:
  // callers MUST provide a non-empty userName.
  it('should render empty salutation when userName is empty string', () => {
    const props: ResetPasswordProps = {
      ...defaultProps,
      userName: '',
    };
    const html = buildResetPasswordEmail(props);
    expect(html).toContain('Halo ,');
  });

  it('should match snapshot with deterministic year=2024', () => {
    const html = buildResetPasswordEmail(defaultProps, { year: 2024 });
    expect(html).toContain('© 2024 MyApp');
    expect(html).toMatchSnapshot();
  });
});
