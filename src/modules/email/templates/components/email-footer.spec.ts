import { renderEmailFooter } from './email-footer';

describe('renderEmailFooter', () => {
  it('should render disclaimer and copyright', () => {
    const html = renderEmailFooter({
      senderName: 'MyApp',
      appName: 'MyApp',
    });
    expect(html).toContain('Email otomatis dari MyApp');
    expect(html).toContain('©');
  });

  it('should use provided year when supplied', () => {
    const html = renderEmailFooter({
      senderName: 'MyApp',
      appName: 'MyApp',
      year: 2024,
    });
    expect(html).toContain('© 2024 MyApp');
  });

  it('should fall back to current year when not provided', () => {
    const html = renderEmailFooter({
      senderName: 'MyApp',
      appName: 'MyApp',
    });
    const currentYear = new Date().getFullYear();
    expect(html).toContain(`© ${currentYear} MyApp`);
  });

  it('should escape senderName and appName', () => {
    const html = renderEmailFooter({
      senderName: 'Acme & Co',
      appName: '<script>alert(1)</script>',
      year: 2024,
    });
    expect(html).toContain('Acme &amp; Co');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
