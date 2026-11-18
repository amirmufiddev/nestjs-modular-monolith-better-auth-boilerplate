import { describe, expect, test } from 'bun:test';
import {
  normalizePhone,
  prepareWhatsappNumber,
  toWahaChatId,
} from './phone.util';

describe('normalizePhone', () => {
  test('converts leading 0 to 62', () => {
    expect(normalizePhone('081255071410')).toBe('6281255071410');
  });

  test('keeps numbers already starting with 62', () => {
    expect(normalizePhone('6281255071410')).toBe('6281255071410');
  });

  test('strips spaces, dashes, parens and + prefix', () => {
    expect(normalizePhone('+62 812-5507-1410')).toBe('6281255071410');
    expect(normalizePhone('(0812) 5507-1410')).toBe('6281255071410');
  });

  test('returns null for empty / whitespace input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });

  test('strips all non-digits when no leading 0', () => {
    expect(normalizePhone('abc123def')).toBe('123');
  });
});

describe('prepareWhatsappNumber', () => {
  test('requires a number when required', () => {
    expect(prepareWhatsappNumber('', true)).toEqual({
      ok: false,
      reason: 'required',
    });
    expect(prepareWhatsappNumber(undefined, true)).toEqual({
      ok: false,
      reason: 'required',
    });
  });

  test('normalizes a valid Indonesian number', () => {
    expect(prepareWhatsappNumber('0812-5507-1410', true)).toEqual({
      ok: true,
      value: '6281255071410',
    });
  });

  test('rejects a number that is too short', () => {
    expect(prepareWhatsappNumber('0812', true)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  test('allows an absent number when not required', () => {
    expect(prepareWhatsappNumber(undefined, false)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe('toWahaChatId', () => {
  test('builds @c.us chatId from local phone', () => {
    expect(toWahaChatId('081255071410')).toBe('6281255071410@c.us');
  });

  test('keeps 62 prefix', () => {
    expect(toWahaChatId('6281255071410')).toBe('6281255071410@c.us');
  });

  test('returns null when input is empty', () => {
    expect(toWahaChatId('')).toBeNull();
  });
});
