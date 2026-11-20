import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';
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
import type { ConfigService } from '@nestjs/config';
import type { AppLoggerService } from '@/logger/logger.service';
import { Readable } from 'node:stream';

describe('S3ObjectStorageAdapter', () => {
  let adapter: S3ObjectStorageAdapter;
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
    adapter = new S3ObjectStorageAdapter(mockConfigService, mockLogger, {
      send,
    } as unknown as S3Client);
  });

  describe('constructor', () => {
    it('should use provided s3Client and not access uploadConfig during instantiation', () => {
      const getSpy = jest.fn();
      const emptyConfigService = { get: getSpy } as unknown as ConfigService;
      const customClient = { send: jest.fn() } as unknown as S3Client;

      const instance = new S3ObjectStorageAdapter(
        emptyConfigService,
        mockLogger,
        customClient,
      );

      expect(instance).toBeDefined();
      expect(getSpy).not.toHaveBeenCalled();
    });

    it('should initialize S3Client from configService when s3Client is not provided', () => {
      const instance = new S3ObjectStorageAdapter(
        mockConfigService,
        mockLogger,
      );

      expect(instance).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalledWith('upload', {
        infer: true,
      });
    });

    it('should throw error when uploadConfig is not found and s3Client is not provided', () => {
      const emptyConfigService = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;

      expect(
        () => new S3ObjectStorageAdapter(emptyConfigService, mockLogger),
      ).toThrow('Upload config tidak tersedia');
    });
  });

  describe('onModuleInit', () => {
    it('should ensure bucket exists on module init', async () => {
      send.mockResolvedValueOnce({});

      await adapter.onModuleInit();

      expect(send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    });

    it('should create bucket when head returns not found', async () => {
      const notFound = new S3ServiceException({
        name: 'NotFound',
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
      });
      send.mockRejectedValueOnce(notFound).mockResolvedValueOnce({});

      await adapter.onModuleInit();

      expect(send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe('putObject', () => {
    it('should put object with options and return key', async () => {
      const body = Buffer.from('hello');
      send.mockResolvedValueOnce({});

      const result = await adapter.putObject({
        key: 'public/org/a.png',
        body,
        contentType: 'image/png',
        metadata: { custom: 'value' },
      });

      expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
      expect(result).toEqual({ key: 'public/org/a.png' });
    });
  });

  describe('getObject', () => {
    it('should return GetObjectResult with stream and metadata', async () => {
      const stream = Readable.from(['content']);
      send.mockResolvedValueOnce({
        Body: stream,
        ContentType: 'image/png',
        ContentLength: 7,
      });

      const result = await adapter.getObject('public/org/a.png');

      expect(send).toHaveBeenCalledWith(expect.any(GetObjectCommand));
      expect(result.body).toBe(stream);
      expect(result.contentType).toBe('image/png');
      expect(result.contentLength).toBe(7);
    });

    it('should throw error when Body is missing', async () => {
      send.mockResolvedValueOnce({
        Body: null,
      });

      await expect(adapter.getObject('missing.png')).rejects.toThrow(
        'Objek S3 tidak memiliki body stream: missing.png',
      );
    });
  });

  describe('deleteObject', () => {
    it('should send DeleteObjectCommand', async () => {
      send.mockResolvedValueOnce({});

      await adapter.deleteObject('public/org/a.png');

      expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe('exists', () => {
    it('should return true when head object succeeds', async () => {
      send.mockResolvedValueOnce({});

      const result = await adapter.exists('public/org/a.png');

      expect(send).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
      expect(result).toBe(true);
    });

    it('should return false when object is missing (404 / NotFound / NoSuchKey)', async () => {
      const notFound = new S3ServiceException({
        name: 'NoSuchKey',
        $fault: 'client',
        $metadata: { httpStatusCode: 404 },
      });
      send.mockRejectedValueOnce(notFound);

      const result = await adapter.exists('public/org/missing.png');

      expect(result).toBe(false);
    });

    it('should rethrow unexpected errors', async () => {
      const serverError = new S3ServiceException({
        name: 'InternalError',
        $fault: 'server',
        $metadata: { httpStatusCode: 500 },
      });
      send.mockRejectedValueOnce(serverError);

      await expect(adapter.exists('public/org/error.png')).rejects.toThrow(
        serverError,
      );
    });
  });
});
