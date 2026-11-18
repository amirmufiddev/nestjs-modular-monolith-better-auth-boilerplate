import { renderEmailButton } from './email-button';
import { createEmailTheme } from '../theme';

describe('renderEmailButton', () => {
  it('should render CTA button with fallback link', () => {
    const html = renderEmailButton({
      label: 'Verifikasi Email',
      href: 'https://example.com/verify',
      theme: createEmailTheme('MyApp'),
    });
    expect(html).toContain('Verifikasi Email');
    expect(html).toContain('href="https://example.com/verify"');
    expect(html).toContain('#0066CC');
  });

  it('should return empty string for unsafe URL', () => {
    const html = renderEmailButton({
      label: 'Click',
      href: 'javascript:alert(1)',
      theme: createEmailTheme('MyApp'),
    });
    expect(html).toBe('');
  });
});
