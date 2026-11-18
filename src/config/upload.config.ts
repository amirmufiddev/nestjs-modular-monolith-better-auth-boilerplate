import { registerAs } from '@nestjs/config';
import { type EnvConfig, validatedEnv } from './env.validation';

export interface UploadConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
}

export function buildUploadConfig(env: EnvConfig): UploadConfig {
  return {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    bucket: env.S3_BUCKET,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
  };
}

export const uploadConfig = registerAs('upload', (): UploadConfig =>
  buildUploadConfig(validatedEnv),
);
