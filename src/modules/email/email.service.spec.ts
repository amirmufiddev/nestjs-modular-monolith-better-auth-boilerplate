import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@/logger/logger.service';
import { BusinessError } from '@/common/errors/business-error';
import { EmailService, maskEmail } from './email.service';

interface EmailTestConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
}

const buildConfig = (overrides: EmailTestConfig = {}): ConfigService => {
  const has = (key: keyof EmailTestConfig) =>
    Object.prototype.hasOwnProperty.call(overrides, key);
  const map: Record<string, unknown> = {
    'email.enabled': has('enabled') ? overrides.enabled : true,
    'email.host': has('host') ? overrides.host : 'smtp.test.local',
    'email.port': has('port') ? overrides.port : 587,
    'email.secure': has('secure') ? overrides.secure : false,
    'email.auth.user': has('user') ? overrides.user : 'user@test.local',
    'email.auth.pass': has('pass') ? overrides.pass : 'secret',
    'email.from': has('from') ? overrides.from : 'noreply@test.local',
    'email.fromName': has('fromName') ? overrides.fromName : 'TestApp',
    'email.replyTo': has('replyTo') ? overrides.replyTo : 'reply@test.local',
    'email.connectionTimeoutMs': 1000,
    'email.greetingTimeoutMs': 1000,
    'email.socketTimeoutMs': 1000,
  };
  return {
    get: (key: string, _options?: { infer?: boolean }) => map[key],
  } as unknown as ConfigService;
};

const buildLogger = (): AppLoggerService =>
  ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }) as unknown as AppLoggerService;

type TransporterMock = {
  sendMail: jest.Mock;
  verify: jest.Mock;
};

const buildTransporter = (): TransporterMock => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-id-001' }),
  verify: jest.fn().mockResolvedValue(true),
});

const setTransporter = (service: EmailService, transporter: unknown) => {
  Reflect.set(service, 'transporter', transporter);
};

describe('EmailService', () => {
  let service: EmailService;
  let logger: AppLoggerService;
  let config: ConfigService;
  let transporter: TransporterMock;

  beforeEach(() => {
    logger = buildLogger();
    config = buildConfig();
    transporter = buildTransporter();
    service = new EmailService(logger, config);
    setTransporter(service, transporter);
  });

  describe('send', () => {
    it('should return messageId when transporter.sendMail succeeds', async () => {
      const id = await service.send({
        to: 'user@example.com',
        subject: 'Halo',
        html: '<p>Hello</p>',
        text: 'Hello',
      });
      expect(id).toBe('msg-id-001');
      expect(transporter.sendMail).toHaveBeenCalledTimes(1);
    });

    it('should propagate to, subject, html, text fields to transporter', async () => {
      await service.send({
        to: 'recipient@example.com',
        subject: 'Order Confirmation',
        html: '<h1>Order</h1>',
        text: 'Order',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.to).toBe('recipient@example.com');
      expect(mailOptions.subject).toBe('Order Confirmation');
      expect(mailOptions.html).toBe('<h1>Order</h1>');
      expect(mailOptions.text).toBe('Order');
    });

    it('should build from header with fromName and fromAddress', async () => {
      await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.from).toBe('"TestApp" <noreply@test.local>');
    });

    it('should include replyTo from caller overrides when provided', async () => {
      await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
        replyTo: 'custom-reply@example.com',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.replyTo).toBe('custom-reply@example.com');
    });

    it('should fall back to email.replyTo config when caller does not provide replyTo', async () => {
      await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.replyTo).toBe('reply@test.local');
    });

    it('should omit replyTo key when neither caller nor config provides it', async () => {
      config = buildConfig({ replyTo: undefined });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.replyTo).toBeUndefined();
    });

    it('should use default "MyApp" when fromName config is missing', async () => {
      config = buildConfig({ fromName: undefined });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      const mailOptions = transporter.sendMail.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(mailOptions.from).toBe('"MyApp" <noreply@test.local>');
    });

    it('should throw BusinessError with EMAIL_DELIVERY_ERROR code on transporter failure', async () => {
      const err = new Error('SMTP connect ETIMEDOUT') as Error & {
        code?: string;
        responseCode?: number;
      };
      err.code = 'ETIMEDOUT';
      err.responseCode = 421;
      transporter.sendMail.mockRejectedValueOnce(err);

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'subj',
          html: '<p>x</p>',
        }),
      ).rejects.toBeInstanceOf(BusinessError);

      try {
        await service.send({
          to: 'user@example.com',
          subject: 'subj',
          html: '<p>x</p>',
        });
      } catch (e) {
        const businessError = e as BusinessError;
        expect(businessError.code).toBe('EMAIL_DELIVERY_ERROR');
        expect(businessError.message).toContain('SMTP connect ETIMEDOUT');
        expect(businessError.context).toMatchObject({
          to: 'user@example.com',
          subject: 'subj',
          code: 'ETIMEDOUT',
          responseCode: 421,
        });
      }
    });

    it('should return empty string when transporter returns object without messageId', async () => {
      transporter.sendMail.mockResolvedValueOnce({});
      const id = await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      expect(id).toBe('');
    });

    it('should return empty string when transporter returns null', async () => {
      transporter.sendMail.mockResolvedValueOnce(null);
      const id = await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      expect(id).toBe('');
    });

    it('should return empty string when transporter returns object with non-string messageId', async () => {
      transporter.sendMail.mockResolvedValueOnce({ messageId: 12345 });
      const id = await service.send({
        to: 'user@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      expect(id).toBe('');
    });

    it('should log error before throwing on failure', async () => {
      const err = new Error('SMTP down') as Error & { code?: string };
      err.code = 'ECONNREFUSED';
      transporter.sendMail.mockRejectedValueOnce(err);

      await expect(
        service.send({
          to: 'user@example.com',
          subject: 'subj',
          html: '<p>x</p>',
        }),
      ).rejects.toThrow(BusinessError);
      const errorMock = logger.error as jest.Mock;
      expect(errorMock).toHaveBeenCalled();
      const errorMessage = errorMock.mock.calls[0]?.[0] as string;
      expect(errorMessage).toContain('SMTP down');
    });

    it('should mask recipient email in log output', async () => {
      await service.send({
        to: 'john.doe@example.com',
        subject: 'subj',
        html: '<p>x</p>',
      });
      const logMock = logger.log as jest.Mock;
      const logMessage = logMock.mock.calls[0]?.[0] as string;
      expect(logMessage).toContain('j***e@example.com');
      expect(logMessage).not.toContain('john.doe@example.com');
    });
  });

  describe('isEnabled', () => {
    it('should return true when email.enabled config is true', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when email.enabled config is false', () => {
      config = buildConfig({ enabled: false });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      expect(service.isEnabled()).toBe(false);
    });

    it('should return false when email.enabled config is missing', () => {
      config = buildConfig({ enabled: undefined });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      expect(service.isEnabled()).toBe(false);
    });
  });

  describe('isConfigured', () => {
    it('should return true when both auth.user and auth.pass are present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when auth.user is missing', () => {
      config = buildConfig({ user: undefined });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when auth.pass is missing', () => {
      config = buildConfig({ pass: undefined });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      expect(service.isConfigured()).toBe(false);
    });

    it('should return false when both auth.user and auth.pass are empty strings', () => {
      config = buildConfig({ user: '', pass: '' });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('onModuleInit', () => {
    it('should verify SMTP connection when enabled', async () => {
      await service.onModuleInit();
      expect(transporter.verify).toHaveBeenCalledTimes(1);
      const logMock = logger.log as jest.Mock;
      expect(logMock).toHaveBeenCalled();
      const initLog = logMock.mock.calls[0]?.[0] as string;
      expect(initLog).toContain('smtp.test.local:587');
    });

    it('should not verify and should log disabled message when disabled', async () => {
      config = buildConfig({ enabled: false });
      service = new EmailService(logger, config);
      setTransporter(service, transporter);
      await service.onModuleInit();
      expect(transporter.verify).not.toHaveBeenCalled();
      const logMock = logger.log as jest.Mock;
      const initLog = logMock.mock.calls[0]?.[0] as string;
      expect(initLog).toContain('Email channel disabled');
    });

    it('should log error and not throw when verify fails', async () => {
      transporter.verify.mockRejectedValueOnce(new Error('SMTP unreachable'));
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      const errorMock = logger.error as jest.Mock;
      expect(errorMock).toHaveBeenCalled();
      const errorMessage = errorMock.mock.calls[0]?.[0] as string;
      expect(errorMessage).toContain('SMTP verify failed');
    });
  });

  describe('maskEmail', () => {
    it('should mask local part keeping first and last char', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
    });

    it('should return "***" for empty string', () => {
      expect(maskEmail('')).toBe('***');
    });

    it('should return "***" for value without @', () => {
      expect(maskEmail('not-an-email')).toBe('***');
    });

    it('should mask single-char local part by repeating it', () => {
      expect(maskEmail('a@example.com')).toBe('a***@example.com');
    });

    it('should keep @ symbol in domain for normal emails', () => {
      expect(maskEmail('user@sub.domain.com')).toBe('u***r@sub.domain.com');
    });
  });
});
