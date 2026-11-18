import { registerAs } from '@nestjs/config';
import { type EnvConfig, validatedEnv } from './env.validation';

export interface QueueConfig {
  enabled: boolean;
  redisHost: string;
  redisPort: number;
  redisDb: number;
  redisPassword?: string;
  defaultAttempts: number;
  backoffDelayMs: number;
  concurrency: number;
}

export function buildQueueConfig(env: EnvConfig): QueueConfig {
  return {
    enabled: env.BROADCAST_QUEUE_ENABLED,
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    redisDb: env.BULLMQ_REDIS_DB,
    redisPassword: env.REDIS_PASSWORD || undefined,
    defaultAttempts: env.BULLMQ_DEFAULT_ATTEMPTS,
    backoffDelayMs: env.BULLMQ_BACKOFF_DELAY_MS,
    concurrency: env.BULLMQ_CONCURRENCY,
  };
}

export const queueConfig = registerAs('queue', (): QueueConfig =>
  buildQueueConfig(validatedEnv),
);
