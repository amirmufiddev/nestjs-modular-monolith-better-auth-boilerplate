import { escapeHtml } from './escape.util';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    expect(escapeHtml('<script>alert("x")</script> & \'test\'')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;',
    );
  });

  it('should return empty string unchanged', () => {
    expect(escapeHtml('')).toBe('');
  });
});
