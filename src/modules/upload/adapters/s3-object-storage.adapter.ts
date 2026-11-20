import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import type { UploadConfig } from '@/config/upload.config';
import { AppLoggerService } from '@/logger/logger.service';
import type {
  GetObjectResult,
  IObjectStorageService,
  PutObjectOptions,
} from '../interfaces/object-storage.interface';

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
export class S3ObjectStorageAdapter
  implements IObjectStorageService, OnModuleInit
{
  private readonly s3: S3Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
    @Optional() s3Client?: S3Client,
  ) {
    if (s3Client) {
      this.s3 = s3Client;
    } else {
      const upload = this.uploadConfig;
      this.s3 = new S3Client({
        endpoint: upload.endpoint,
        region: upload.region,
        credentials: {
          accessKeyId: upload.accessKeyId,
          secretAccessKey: upload.secretAccessKey,
        },
        forcePathStyle: upload.forcePathStyle,
      });
    }
  }

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
        context: 'S3ObjectStorageAdapter',
        bucket,
      });
    } catch (error: unknown) {
      if (!isBucketMissing(error)) {
        this.logger.error(
          `Gagal memeriksa bucket S3: ${bucket}`,
          error instanceof Error ? error.stack : undefined,
          { context: 'S3ObjectStorageAdapter', bucket },
        );
        throw error;
      }
      await this.s3.send(new CreateBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket S3 dibuat: ${bucket}`, {
        context: 'S3ObjectStorageAdapter',
        bucket,
      });
    }
  }

  async putObject(
    options: PutObjectOptions,
  ): Promise<{ key: string; url?: string }> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.uploadConfig.bucket,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType,
        Metadata: options.metadata,
      }),
    );
    return { key: options.key };
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

  async getObject(key: string): Promise<GetObjectResult> {
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
    return {
      body: body as unknown as NodeJS.ReadableStream,
      contentType: result.ContentType ?? 'application/octet-stream',
      contentLength: result.ContentLength,
    };
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.uploadConfig.bucket,
        Key: key,
      }),
    );
  }
}
