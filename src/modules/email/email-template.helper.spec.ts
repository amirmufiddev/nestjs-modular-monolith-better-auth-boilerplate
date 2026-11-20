import {
  humanizeTemplateKey,
  resolveSubject,
  wrapAsHtml,
  isValidEmail,
  escapeHtml,
} from './email-template.helper';

describe('EmailTemplateHelper', () => {
  describe('humanizeTemplateKey', () => {
    it('should convert kebab-case template keys to Title Case', () => {
      expect(humanizeTemplateKey('email-verification')).toBe(
        'Email Verification',
      );
      expect(humanizeTemplateKey('user-password-reset')).toBe(
        'User Password Reset',
      );
    });

    it('should handle consecutive hyphens and empty string parts', () => {
      expect(humanizeTemplateKey('org--invitation')).toBe('Org Invitation');
      expect(humanizeTemplateKey('')).toBe('');
    });
  });

  describe('resolveSubject', () => {
    it('should return caller override if provided', () => {
      const subject = resolveSubject(
        'email-verification',
        '[APP]',
        'Custom Subject',
      );
      expect(subject).toBe('[APP] Custom Subject');
    });

    it('should humanize templateKey when no override', () => {
      const subject = resolveSubject('organization-invitation', '[APP]');
      expect(subject).toBe('[APP] Organization Invitation');
    });

    it('should fallback to humanized templateKey for unknown keys', () => {
      const subject = resolveSubject('unknown-template-key', '[APP]');
      expect(subject).toBe('[APP] Unknown Template Key');
    });

    it('should return subject without leading space when prefix is empty', () => {
      const subject = resolveSubject('email-verification', '');
      expect(subject).toBe('Email Verification');
    });
  });

  describe('wrapAsHtml', () => {
    it('should wrap plain text with default options', () => {
      const html = wrapAsHtml('Hello World');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>Notifikasi MyApp</title>');
      expect(html).toContain('Hello World');
      expect(html).toContain('Email otomatis dari MyApp');
    });

    it('should wrap plain text with custom title and orgName', () => {
      const html = wrapAsHtml('Invitation body text', {
        title: 'Judul Custom',
        orgName: 'MyApp',
      });
      expect(html).toContain('<title>Judul Custom</title>');
      expect(html).toContain(
        '<h1 style="margin:0 0 16px 0;font-size:18px;color:#111827;">Judul Custom</h1>',
      );
      expect(html).toContain('Email otomatis dari MyApp');
    });

    it('should escape HTML characters in plainText and options', () => {
      const plainTextWithHtml =
        '<script>alert("xss")</script> & "quote" \'single\'';
      const html = wrapAsHtml(plainTextWithHtml, {
        title: '<Title & Test>',
        orgName: 'Org "Name"',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quote&quot; &#39;single&#39;',
      );
      expect(html).toContain('&lt;Title &amp; Test&gt;');
      expect(html).toContain('Org &quot;Name&quot;');
    });

    it('should convert newlines to <br/> tags', () => {
      const multilineText = 'Line 1\nLine 2\r\nLine 3';
      const html = wrapAsHtml(multilineText);
      expect(html).toContain('Line 1<br/>Line 2<br/>Line 3');
    });
  });

  describe('isValidEmail', () => {
    it('should return false for null, undefined, or empty/whitespace strings', () => {
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('   ')).toBe(false);
    });

    it('should return false for emails longer than 254 characters', () => {
      const longEmail = 'a'.repeat(250) + '@test.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });

    it('should return false for malformed email strings', () => {
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missinguser.com')).toBe(false);
      expect(isValidEmail('missingdomain@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
    });

    it('should return true for valid email strings', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('  user.name+tag@domain.co.id  ')).toBe(true);
    });
  });

  describe('escapeHtml', () => {
    it('should escape special HTML characters', () => {
      expect(escapeHtml('<script>alert("xss")</script> & \'quote\'')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;quote&#39;',
      );
    });
  });
});
