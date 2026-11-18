import { maskPhone, maskEmail } from './pii.util';

describe('pii.util', () => {
  describe('maskPhone', () => {
    it('should mask standard Indonesian mobile phone number with country code', () => {
      expect(maskPhone('6281234567890')).toBe('6281*******90');
    });

    it('should mask local phone format starting with 08', () => {
      expect(maskPhone('081234567890')).toBe('0812******90');
    });

    it('should mask phone number starting with +62', () => {
      expect(maskPhone('+6281234567890')).toBe('+628********90');
    });

    it('should preserve WhatsApp @c.us suffix while masking number', () => {
      expect(maskPhone('6281234567890@c.us')).toBe('6281*******90@c.us');
    });

    it('should preserve WhatsApp @s.whatsapp.net suffix while masking number', () => {
      expect(maskPhone('6281234567890@s.whatsapp.net')).toBe(
        '6281*******90@s.whatsapp.net',
      );
    });

    it('should mask short phone numbers appropriately', () => {
      expect(maskPhone('1234')).toBe('****');
      expect(maskPhone('081234')).toBe('08**34');
    });

    it('should return *** for null, undefined, or empty string', () => {
      expect(maskPhone(null)).toBe('***');
      expect(maskPhone(undefined)).toBe('***');
      expect(maskPhone('')).toBe('***');
      expect(maskPhone('   ')).toBe('***');
    });
  });

  describe('maskEmail', () => {
    it('should mask standard email address keeping first and last chars of local part', () => {
      expect(maskEmail('user@example.com')).toBe('u***r@example.com');
      expect(maskEmail('john.doe@domain.co.id')).toBe('j***e@domain.co.id');
    });

    it('should handle single-character local part', () => {
      expect(maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should handle two-character local part', () => {
      expect(maskEmail('ab@example.com')).toBe('a***b@example.com');
    });

    it('should return *** for null, undefined, empty, or invalid email', () => {
      expect(maskEmail(null)).toBe('***');
      expect(maskEmail(undefined)).toBe('***');
      expect(maskEmail('')).toBe('***');
      expect(maskEmail('invalid-email')).toBe('***');
    });
  });
});
