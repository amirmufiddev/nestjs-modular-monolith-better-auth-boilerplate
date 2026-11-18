import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import type { UploadConfig } from '@/config/upload.config';
import { AppLoggerService } from '@/logger/logger.service';
import { S3_CLIENT } from '../upload.tokens';

function isBucketMissing(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) {
    return false;
  }
  const status = error.$metadata.httpStatusCode;
  return (
    status === 404 || error.name === 'NotFound' || error.name === 'NoSuchBucket'
  );
}

function isObjectMissing(error: unknown): boolean {
  if (!(error instanceof S3ServiceException)) {
    return false;
  }
  const status = error.$metadata.httpStatusCode;
  return (
    status === 404 || error.name === 'NotFound' || error.name === 'NoSuchKey'
  );
}

@Injectable()
export class S3ObjectStorageService implements OnModuleInit {
  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {}

  private get uploadConfig(): UploadConfig {
    const config = this.configService.get<UploadConfig>('upload', {
      infer: true,
    });
    if (!config) {
      throw new Error('Upload config tidak tersedia');
    }
    return config;
  }

  async onModuleInit(): Promise<void> {
    const { bucket } = this.uploadConfig;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      this.logger.debug(`S3 bucket siap: ${bucket}`, {
        context: 'S3ObjectStorageService',
        bucket,
      });
    } catch (error: unknown) {
      if (!isBucketMissing(error)) {
        this.logger.error(
          `Gagal memeriksa bucket S3: ${bucket}`,
          error instanceof Error ? error.stack : undefined,
          { context: 'S3ObjectStorageService', bucket },
        );
        throw error;
      }
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket S3 dibuat: ${bucket}`, {
        context: 'S3ObjectStorageService',
        bucket,
      });
    }
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.uploadConfig.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({
          Bucket: this.uploadConfig.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (isObjectMissing(error)) {
        return false;
      }
      throw error;
    }
  }

  async getObject(key: string): Promise<Readable> {
    const result = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.uploadConfig.bucket,
        Key: key,
      }),
    );
    const body = result.Body;
    if (!body) {
      throw new Error(`Objek S3 tidak memiliki body stream: ${key}`);
    }
    return body as Readable;
  }
}
