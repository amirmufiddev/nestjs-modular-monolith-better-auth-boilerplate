import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppLoggerService } from '@/logger/logger.service';
import { BusinessError } from '@/common/errors/business-error';
import { maskEmail } from '@/logger/pii.util';

export { maskEmail };

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly logger: AppLoggerService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('email.host', { infer: true }),
      port: this.config.get<number>('email.port', { infer: true }),
      secure: this.config.get<boolean>('email.secure', { infer: true }),
      auth: {
        user: this.config.get<string>('email.auth.user', { infer: true }),
        pass: this.config.get<string>('email.auth.pass', { infer: true }),
      },
      connectionTimeout: this.config.get<number>('email.connectionTimeoutMs', {
        infer: true,
      }),
      greetingTimeout: this.config.get<number>('email.greetingTimeoutMs', {
        infer: true,
      }),
      socketTimeout: this.config.get<number>('email.socketTimeoutMs', {
        infer: true,
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    const enabled =
      this.config.get<boolean>('email.enabled', { infer: true }) === true;
    if (!enabled) {
      this.logger.log('Email channel disabled (EMAIL_ENABLED=false)', {
        context: 'EmailService',
        enabled: false,
      });
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log(
        `SMTP connection verified (${this.config.get<string>('email.host', { infer: true })}:${this.config.get<number>('email.port', { infer: true })})`,
        {
          context: 'EmailService',
          host: this.config.get<string>('email.host', { infer: true }),
          port: this.config.get<number>('email.port', { infer: true }),
        },
      );
    } catch (err) {
      this.logger.error(`SMTP verify failed: ${(err as Error).message}`, err, {
        context: 'EmailService',
      });
    }
  }

  isEnabled(): boolean {
    return this.config.get<boolean>('email.enabled', { infer: true }) === true;
  }

  private extractMessageId(info: unknown): string {
    if (!info || typeof info !== 'object') return '';
    const candidate = (info as { messageId?: unknown }).messageId;
    if (typeof candidate === 'string') return candidate;
    return '';
  }

  isConfigured(): boolean {
    const user = this.config.get<string>('email.auth.user');
    const pass = this.config.get<string>('email.auth.pass');
    return Boolean(user && pass);
  }

  async send(opts: SendEmailOptions): Promise<string> {
    const fromName = this.config.get<string>('email.fromName') ?? 'MyApp';
    const fromAddress = this.config.get<string>('email.from') ?? '';
    const replyTo = opts.replyTo ?? this.config.get<string>('email.replyTo');

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${fromName}" <${fromAddress}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(replyTo ? { replyTo } : {}),
      };
      const sendResult: unknown = await this.transporter.sendMail(mailOptions);
      const messageId = this.extractMessageId(sendResult);
      this.logger.log(`Email sent to ${maskEmail(opts.to)}: ${messageId}`, {
        context: 'EmailService',
        to: maskEmail(opts.to),
        messageId,
      });
      return messageId;
    } catch (err) {
      const error = err as Error & {
        code?: string;
        responseCode?: number;
      };
      this.logger.error(
        `Failed to send email to ${maskEmail(opts.to)}: ${error.message}`,
        error,
        {
          context: 'EmailService',
          to: maskEmail(opts.to),
        },
      );
      throw BusinessError.badRequest(
        `SMTP delivery error: ${error.message}`,
        'EMAIL_DELIVERY_ERROR',
        {
          to: opts.to,
          subject: opts.subject,
          code: error.code,
          responseCode: error.responseCode,
        },
      );
    }
  }
}
