import { isSafeHttpUrl } from './url.util';

describe('isSafeHttpUrl', () => {
  it('should allow http and https URLs', () => {
    expect(isSafeHttpUrl('https://example.com/path')).toBe(true);
    expect(isSafeHttpUrl('http://localhost:3000/invite/abc')).toBe(true);
  });

  it('should reject javascript and other schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,test')).toBe(false);
    expect(isSafeHttpUrl('')).toBe(false);
    expect(isSafeHttpUrl('invalid-url')).toBe(false);
  });
});
