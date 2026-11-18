import { resolveAbsoluteAssetUrl } from './asset-url.util';

describe('resolveAbsoluteAssetUrl', () => {
  it('should return undefined for empty values', () => {
    expect(
      resolveAbsoluteAssetUrl(null, 'https://api.example.com'),
    ).toBeUndefined();
    expect(
      resolveAbsoluteAssetUrl('', 'https://api.example.com'),
    ).toBeUndefined();
    expect(
      resolveAbsoluteAssetUrl(undefined, 'https://api.example.com'),
    ).toBeUndefined();
  });

  it('should return absolute URL unchanged when it is a safe http/https URL', () => {
    expect(
      resolveAbsoluteAssetUrl(
        'https://cdn.example.com/logo.png',
        'https://api.example.com',
      ),
    ).toBe('https://cdn.example.com/logo.png');
    expect(
      resolveAbsoluteAssetUrl(
        'http://cdn.example.com/logo.png',
        'https://api.example.com',
      ),
    ).toBe('http://cdn.example.com/logo.png');
  });

  it('should prepend baseUrl for relative paths', () => {
    expect(
      resolveAbsoluteAssetUrl('/uploads/logo.png', 'https://api.example.com'),
    ).toBe('https://api.example.com/uploads/logo.png');
    expect(
      resolveAbsoluteAssetUrl('uploads/logo.png', 'https://api.example.com/'),
    ).toBe('https://api.example.com/uploads/logo.png');
  });

  it('should return undefined when baseUrl is empty/undefined and path is relative', () => {
    expect(
      resolveAbsoluteAssetUrl('/uploads/logo.png', undefined),
    ).toBeUndefined();
    expect(resolveAbsoluteAssetUrl('/uploads/logo.png', null)).toBeUndefined();
    expect(resolveAbsoluteAssetUrl('/uploads/logo.png', '')).toBeUndefined();
    expect(resolveAbsoluteAssetUrl('uploads/logo.png', '')).toBeUndefined();
  });

  it('should still resolve absolute http/https URLs when baseUrl is empty/undefined', () => {
    expect(
      resolveAbsoluteAssetUrl('https://cdn.example.com/logo.png', undefined),
    ).toBe('https://cdn.example.com/logo.png');
    expect(
      resolveAbsoluteAssetUrl('https://cdn.example.com/logo.png', null),
    ).toBe('https://cdn.example.com/logo.png');
    expect(
      resolveAbsoluteAssetUrl('https://cdn.example.com/logo.png', ''),
    ).toBe('https://cdn.example.com/logo.png');
  });

  it('should return undefined when resolved relative URL is not a safe http/https URL', () => {
    // Base URL must itself be a safe http/https URL; otherwise resolution
    // produces an unsafe value and we reject it.
    expect(
      resolveAbsoluteAssetUrl('/uploads/logo.png', 'not-a-valid-url'),
    ).toBeUndefined();
    expect(
      resolveAbsoluteAssetUrl('/uploads/logo.png', 'javascript:alert(1)'),
    ).toBeUndefined();
  });
});
