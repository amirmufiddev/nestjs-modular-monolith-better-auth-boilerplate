import { S3ObjectStorageService } from './s3-object-storage.service';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import type { AppLoggerService } from '@/logger/logger.service';

describe('S3ObjectStorageService', () => {
  let service: S3ObjectStorageService;
  let send: jest.Mock;
  let mockConfigService: ConfigService;
  let mockLogger: AppLoggerService;

  beforeEach(() => {
    send = jest.fn();
    mockConfigService = {
      get: jest.fn().mockReturnValue({
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucket: 'uploads',
        forcePathStyle: true,
      }),
    } as unknown as ConfigService;
    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as unknown as AppLoggerService;
    service = new S3ObjectStorageService(
      { send } as unknown as S3Client,
      mockConfigService,
      mockLogger,
    );
  });

  it('should ensure bucket exists on module init', async () => {
    send.mockResolvedValueOnce({});

    await service.onModuleInit();

    expect(send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
  });

  it('should create bucket when head returns not found', async () => {
    const notFound = new S3ServiceException({
      name: 'NotFound',
      $fault: 'client',
      $metadata: { httpStatusCode: 404 },
    });
    send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});

    await service.onModuleInit();

    expect(send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    expect(mockLogger.log).toHaveBeenCalled();
  });

  it('should put object with content type', async () => {
    const body = Buffer.from('hello');
    send.mockResolvedValueOnce({});

    await service.putObject('public/org/a.png', body, 'image/png');

    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
  });
});