import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App } from 'firebase-admin/app';
import { cert, initializeApp, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { DriverTokenRepository } from './driver-token.repository';
import { AppLoggerService } from '@/logger/logger.service';
import { resolveFcmCredentials } from './fcm-credentials';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class FcmAdapter {
  private app: App | null = null;
  private enabled = false;

  constructor(
    private readonly config: ConfigService,
    private readonly driverTokens: DriverTokenRepository,
    private readonly logger: AppLoggerService,
  ) {
    this.initialize();
  }

  private initialize(): void {
    const credentials = resolveFcmCredentials({
      credentialsPath: this.config.get<string>('FCM_CREDENTIALS_PATH'),
    });

    if (!credentials) {
      this.logger.warn(
        'FCM not configured — push notifications disabled (no-op mode)',
        { context: 'FcmAdapter' },
      );
      this.enabled = false;
      return;
    }

    const { projectId, privateKey, clientEmail } = credentials;

    try {
      const serviceAccount: ServiceAccount = {
        projectId,
        privateKey,
        clientEmail,
      };
      this.app = initializeApp(
        {
          credential: cert(serviceAccount),
        },
        'nestjs-boilerplate-fcm',
      );
      this.enabled = true;
      this.logger.log('FCM initialized', {
        context: 'FcmAdapter',
        projectId,
      });
    } catch (err) {
      this.logger.error('Failed to initialize FCM', err as Error, {
        context: 'FcmAdapter',
      });
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async sendToToken(token: string, payload: PushPayload): Promise<boolean> {
    if (!this.enabled || !this.app) {
      this.logger.debug('FCM disabled, dropping push', {
        context: 'FcmAdapter',
        tokenPrefix: token.slice(0, 10),
        title: payload.title,
      });
      return false;
    }

    try {
      const messaging = getMessaging(this.app);
      const messageId = await messaging.send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
      });
      this.logger.debug('FCM sent', {
        context: 'FcmAdapter',
        messageId,
      });
      return true;
    } catch (err) {
      this.logger.error('FCM send failed to token', err as Error, {
        context: 'FcmAdapter',
        tokenPrefix: token.slice(0, 10),
      });
      return false;
    }
  }

  /**
   * Send push notification to a user by their Better Auth user ID.
   * Driver-role users are addressed via this userId.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<boolean> {
    const tokens = await this.driverTokens.findByUserId(userId);
    if (tokens.length === 0) {
      this.logger.debug('No FCM tokens for user, dropping push', {
        context: 'FcmAdapter',
        userId,
        title: payload.title,
      });
      return false;
    }

    const results = await Promise.allSettled(
      tokens.map(async (token) => {
        const ok = await this.sendToToken(token.fcmToken, payload);
        return { token: token.fcmToken, ok };
      }),
    );

    let anyDelivered = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ok) {
          anyDelivered = true;
        }
      } else {
        this.logger.error(
          'Unexpected failure while sending push to user',
          result.reason,
          {
            context: 'FcmAdapter',
            userId,
          },
        );
      }
    }

    return anyDelivered;
  }

  /**
   * @deprecated Use sendToUser(userId, payload). Driver identity is now derived
   * from the linked Better Auth user; FCM tokens are addressed by userId.
   */
  sendToDriver(_driverId: string, _payload: PushPayload): Promise<boolean> {
    this.logger.warn(
      'fcmAdapter.sendToDriver is deprecated; use sendToUser(userId, payload)',
      { context: 'FcmAdapter' },
    );
    return Promise.resolve(false);
  }
}
