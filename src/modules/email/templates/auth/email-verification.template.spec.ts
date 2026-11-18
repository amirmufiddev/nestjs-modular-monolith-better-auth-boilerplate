import { buildEmailVerificationEmail } from './email-verification.template';
import type { EmailVerificationProps } from '../types';

describe('buildEmailVerificationEmail', () => {
  const defaultProps: EmailVerificationProps = {
    userName: 'Budi Santoso',
    verificationUrl: 'https://example.com/verify-email?token=xyz123abc',
    appName: 'MyApp',
  };

  it('should generate email layout with proper title', () => {
    const html = buildEmailVerificationEmail(defaultProps);
    expect(html).toContain('<title>Verifikasi Email MyApp</title>');
  });

  it('should render heading, salutation, thank you message, and CTA button', () => {
    const html = buildEmailVerificationEmail(defaultProps);

    // Heading & Salutation
    expect(html).toContain('Verifikasi Email Anda');
    expect(html).toContain('Halo Budi Santoso,');

    // Registration thank you message
    expect(html).toContain('Terima kasih telah mendaftar di MyApp!');
    expect(html).toContain(
      'Silakan verifikasi alamat email Anda dengan mengklik tombol di bawah:',
    );

    // CTA Button with verificationUrl
    expect(html).toContain(
      'href="https://example.com/verify-email?token=xyz123abc"',
    );
    expect(html).toContain('Verifikasi Email');
  });

  it('should escape userName and appName to prevent XSS', () => {
    const maliciousProps: EmailVerificationProps = {
      userName: '<script>alert("xss")</script>',
      verificationUrl: 'https://example.com/verify-email?token=safe',
      appName: '<b>Acme & Co</b>',
    };

    const html = buildEmailVerificationEmail(maliciousProps);

    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );

    expect(html).not.toContain('<b>Acme & Co</b>');
    expect(html).toContain('&lt;b&gt;Acme &amp; Co&lt;/b&gt;');
  });

  it('should match snapshot with deterministic year=2024', () => {
    const html = buildEmailVerificationEmail(defaultProps, { year: 2024 });
    expect(html).toContain('© 2024 MyApp');
    expect(html).toMatchSnapshot();
  });
});
