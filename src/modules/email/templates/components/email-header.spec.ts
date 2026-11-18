import { renderEmailHeader } from './email-header';

describe('renderEmailHeader', () => {
  it('should render text-only header when logo is missing', () => {
    const html = renderEmailHeader({ displayName: 'MyApp' });
    expect(html).toContain('MyApp');
    expect(html).not.toContain('<img');
  });

  it('should render logo when logoUrl is provided', () => {
    const html = renderEmailHeader({
      displayName: 'Acme Org',
      logoUrl: 'https://api.example.com/uploads/logo.png',
    });
    expect(html).toContain('src="https://api.example.com/uploads/logo.png"');
    expect(html).toContain('alt="Acme Org"');
  });

  it('should escape displayName', () => {
    const html = renderEmailHeader({ displayName: 'Org <script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Org &lt;script&gt;');
  });
});
