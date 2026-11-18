import { renderEmailLayout } from './email-layout';

describe('renderEmailLayout', () => {
  it('should render full HTML document structure', () => {
    const html = renderEmailLayout({
      title: 'Test Email',
      header: { displayName: 'MyApp' },
      bodyHtml: '<p>Body content</p>',
      footer: { senderName: 'MyApp', appName: 'MyApp' },
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain('<title>Test Email</title>');
    expect(html).toContain('Body content');
  });

  it('should forward year prop to the footer', () => {
    const html = renderEmailLayout({
      title: 'Test Email',
      header: { displayName: 'MyApp' },
      bodyHtml: '<p>Body</p>',
      footer: { senderName: 'MyApp', appName: 'MyApp' },
      year: 2024,
    });
    expect(html).toContain('© 2024 MyApp');
  });

  it('should default to current year when year is not provided', () => {
    const currentYear = new Date().getFullYear();
    const html = renderEmailLayout({
      title: 'Test Email',
      header: { displayName: 'MyApp' },
      bodyHtml: '<p>Body</p>',
      footer: { senderName: 'MyApp', appName: 'MyApp' },
    });
    expect(html).toContain(`© ${currentYear} MyApp`);
  });
});
