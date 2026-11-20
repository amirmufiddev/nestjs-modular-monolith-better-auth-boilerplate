import { UploadService, validateMagicBytes } from './upload.service';
import { BusinessError } from '@/common/errors/business-error';
import { AppLoggerService } from '@/logger/logger.service';
import type { IObjectStorageService } from '../interfaces/object-storage.interface';
import { Readable } from 'node:stream';

describe('UploadService', () => {
  let service: UploadService;
  let mockStorage: jest.Mocked<IObjectStorageService>;
  let mockLogger: jest.Mocked<AppLoggerService>;

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const orgId = 'org-abc-123';

  beforeEach(() => {
    mockStorage = {
      putObject: jest.fn().mockResolvedValue({ key: 'test' }),
      exists: jest.fn().mockResolvedValue(false),
      getObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;
    service = new UploadService(mockStorage, mockLogger);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateMagicBytes', () => {
    it('should return true for valid PNG magic bytes', () => {
      expect(validateMagicBytes(validPngBuffer, 'image/png')).toBe(true);
    });

    it('should return false for invalid magic bytes', () => {
      const invalidBuffer = Buffer.from('fake data text file');
      expect(validateMagicBytes(invalidBuffer, 'image/png')).toBe(false);
    });
  });

  describe('saveFile', () => {
    it('should save public file under public/{orgId} object key', async () => {
      const mockFile = {
        filename: 'test.png',
        buffer: validPngBuffer,
        mimetype: 'image/png',
      };

      const result = await service.saveFile(mockFile, 'public', orgId);
      expect(result).toContain(`/uploads/public/${orgId}/`);
      expect(result).toMatch(/\.png$/);
      expect(mockStorage.putObject).toHaveBeenCalledWith({
        key: expect.stringMatching(/^public\/org-abc-123\/[\w-]+\.png$/),
        body: validPngBuffer,
        contentType: 'image/png',
      });
    });

    it('should save private file under private/{orgId} object key', async () => {
      const mockFile = {
        filename: 'test.png',
        buffer: validPngBuffer,
        mimetype: 'image/png',
      };

      const result = await service.saveFile(mockFile, 'private', orgId);
      expect(result).toContain(`/uploads/private/${orgId}/`);
      expect(mockStorage.putObject).toHaveBeenCalledWith({
        key: expect.stringMatching(/^private\/org-abc-123\/[\w-]+\.png$/),
        body: validPngBuffer,
        contentType: 'image/png',
      });
    });

    it('should include sub-path in object key and URL', async () => {
      const mockFile = {
        filename: 'banner.webp',
        buffer: validPngBuffer,
        mimetype: 'image/png',
      };

      const result = await service.saveFile(mockFile, 'public', orgId, 'media');
      expect(result).toContain(`/uploads/public/${orgId}/media/`);
      expect(mockStorage.putObject).toHaveBeenCalledWith({
        key: expect.stringMatching(
          /^public\/org-abc-123\/media\/[\w-]+\.webp$/,
        ),
        body: validPngBuffer,
        contentType: 'image/png',
      });
    });
  });

  describe('resolveObjectKey', () => {
    it('should build object key with visibility and organization', () => {
      const key = service.resolveObjectKey('public', orgId, 'media/abc.png');
      expect(key).toBe('public/org-abc-123/media/abc.png');
    });

    it('should reject path traversal attempts', () => {
      expect(() =>
        service.resolveObjectKey('public', orgId, '../../etc/passwd'),
      ).toThrow(BusinessError);
    });

    it('should reject path traversal in organizationId', () => {
      expect(() =>
        service.resolveObjectKey('public', '../evil', 'file.png'),
      ).toThrow(BusinessError);
    });
  });

  describe('fileExists', () => {
    it('should return true when public object exists', async () => {
      mockStorage.exists.mockResolvedValueOnce(true);

      const result = await service.fileExists('public', orgId, 'test.png');
      expect(result).toBe(true);
      expect(mockStorage.exists).toHaveBeenCalledWith(
        'public/org-abc-123/test.png',
      );
    });

    it('should fallback to legacy key for private visibility', async () => {
      mockStorage.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      const result = await service.fileExists('private', orgId, 'test.png');
      expect(result).toBe(true);
      expect(mockStorage.exists).toHaveBeenNthCalledWith(
        1,
        'private/org-abc-123/test.png',
      );
      expect(mockStorage.exists).toHaveBeenNthCalledWith(
        2,
        'org-abc-123/test.png',
      );
    });

    it('should NOT fallback to legacy key when visibility is public', async () => {
      mockStorage.exists.mockResolvedValueOnce(false);

      const result = await service.fileExists('public', orgId, 'test.png');
      expect(result).toBe(false);
      expect(mockStorage.exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFile', () => {
    it('should return stream for public object', async () => {
      const stream = Readable.from(['data']);
      mockStorage.exists.mockResolvedValueOnce(true);
      mockStorage.getObject.mockResolvedValueOnce({
        body: stream,
        contentType: 'image/png',
      });

      const result = await service.getFile('public', orgId, 'test.png');
      expect(result.fileName).toBe('test.png');
      expect(result.objectKey).toBe('public/org-abc-123/test.png');
      expect(result.body).toBe(stream);
    });

    it('should fallback to legacy private key', async () => {
      const stream = Readable.from(['data']);
      mockStorage.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      mockStorage.getObject.mockResolvedValueOnce({
        body: stream,
        contentType: 'image/png',
      });

      const result = await service.getFile('private', orgId, 'test.png');
      expect(result.objectKey).toBe('org-abc-123/test.png');
    });

    it('should throw notFound for public getFile when object missing', async () => {
      mockStorage.exists.mockResolvedValueOnce(false);

      await expect(
        service.getFile('public', orgId, 'test.png'),
      ).rejects.toThrow(BusinessError);
      expect(mockStorage.exists).toHaveBeenCalledTimes(1);
    });
  });
});
