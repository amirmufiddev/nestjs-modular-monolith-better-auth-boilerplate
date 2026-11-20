class DummyAuthGuard {}

jest.mock('@thallesp/nestjs-better-auth', () => ({
  AuthGuard: DummyAuthGuard,
  Public: () => jest.fn(),
  AllowAnonymous: () => jest.fn(),
  MemberHasPermission: () => jest.fn(),
  OrgRoles: () => jest.fn(),
  Session: () => (_target: any, _key: string, index: number) => {
    Reflect.defineMetadata('session_param_index', index, _target, _key);
  },
}));

import { Readable } from 'node:stream';
import { UploadController } from './upload.controller';
import { UploadService } from '../services/upload.service';
import { BusinessError } from '@/common/errors/business-error';

describe('UploadController', () => {
  let controller: UploadController;
  let mockService: jest.Mocked<UploadService>;

  const orgId = 'org-abc-123';
  const mockSession = {
    session: { activeOrganizationId: orgId },
    user: { id: 'user-1', email: 'test@test.com' },
  };

  beforeEach(() => {
    mockService = {
      saveFile: jest.fn(),
      resolveFilePath: jest.fn(),
      fileExists: jest.fn(),
      getFile: jest.fn(),
    } as any;

    controller = new UploadController(mockService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have correct route prefix uploads', () => {
    const PATH_METADATA = 'path';
    const routePath = Reflect.getMetadata(PATH_METADATA, UploadController);
    expect(routePath).toBe('uploads');
  });

  describe('uploadPublicFile (POST /v1/uploads/public)', () => {
    it('should throw badRequest if not multipart request', async () => {
      const mockReq = {
        isMultipart: () => false,
      } as any;

      await expect(
        controller.uploadPublicFile(mockReq, mockSession as any),
      ).rejects.toThrow(BusinessError);
    });

    it('should throw badRequest if file is missing in multipart', async () => {
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(null),
      } as any;

      await expect(
        controller.uploadPublicFile(mockReq, mockSession as any),
      ).rejects.toThrow(BusinessError);
    });

    it('should throw badRequest when no active organization', async () => {
      const sessionNoOrg = {
        session: { activeOrganizationId: null },
        user: { id: 'user-1' },
      };

      const mockFileObject = {
        filename: 'image.jpg',
        mimetype: 'image/jpeg',
        toBuffer: () => Promise.resolve(Buffer.from('fakeimg')),
        fields: {},
      };
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(mockFileObject),
      } as any;

      await expect(
        controller.uploadPublicFile(mockReq, sessionNoOrg as any),
      ).rejects.toThrow(BusinessError);
    });

    it('should call uploadService.saveFile with public visibility and organizationId', async () => {
      const mockFileObject = {
        filename: 'image.jpg',
        mimetype: 'image/jpeg',
        toBuffer: () => Promise.resolve(Buffer.from('fakeimg')),
        fields: {},
      };
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(mockFileObject),
      } as any;

      mockService.saveFile.mockResolvedValueOnce(
        `/uploads/public/${orgId}/unique-img.jpg`,
      );

      const result = await controller.uploadPublicFile(
        mockReq,
        mockSession as any,
      );
      expect(mockService.saveFile).toHaveBeenCalledWith(
        {
          filename: 'image.jpg',
          mimetype: 'image/jpeg',
          buffer: expect.any(Buffer),
        },
        'public',
        orgId,
        undefined,
      );
      expect(result).toEqual({
        url: `/uploads/public/${orgId}/unique-img.jpg`,
      });
    });

    it('should pass sub-path from multipart fields', async () => {
      const mockFileObject = {
        filename: 'image.jpg',
        mimetype: 'image/jpeg',
        toBuffer: () => Promise.resolve(Buffer.from('fakeimg')),
        fields: {
          path: { value: 'media' },
        },
      };
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(mockFileObject),
      } as any;

      mockService.saveFile.mockResolvedValueOnce(
        `/uploads/public/${orgId}/media/unique-img.jpg`,
      );

      await controller.uploadPublicFile(mockReq, mockSession as any);
      expect(mockService.saveFile).toHaveBeenCalledWith(
        expect.any(Object),
        'public',
        orgId,
        'media',
      );
    });
  });

  describe('uploadPrivateFile (POST /v1/uploads/private)', () => {
    it('should call uploadService.saveFile with private visibility and organizationId', async () => {
      const mockFileObject = {
        filename: 'doc.pdf',
        mimetype: 'application/pdf',
        toBuffer: () => Promise.resolve(Buffer.from('fakepdf')),
        fields: {},
      };
      const mockReq = {
        isMultipart: () => true,
        file: () => Promise.resolve(mockFileObject),
      } as any;

      mockService.saveFile.mockResolvedValueOnce(
        `/uploads/private/${orgId}/unique-doc.pdf`,
      );

      const result = await controller.uploadPrivateFile(
        mockReq,
        mockSession as any,
      );
      expect(mockService.saveFile).toHaveBeenCalledWith(
        {
          filename: 'doc.pdf',
          mimetype: 'application/pdf',
          buffer: expect.any(Buffer),
        },
        'private',
        orgId,
        undefined,
      );
      expect(result).toEqual({
        url: `/uploads/private/${orgId}/unique-doc.pdf`,
      });
    });
  });

  describe('servePublicFile (GET /v1/uploads/public/:organizationId/*)', () => {
    it('should serve file with public cache header and correct Content-Type', async () => {
      const mockStream = Readable.from(['bytes']) as any;

      mockService.getFile.mockResolvedValueOnce({
        objectKey: 'public/org/sub/test.jpg',
        fileName: 'test.jpg',
        body: mockStream,
      });

      const mockHeader = jest.fn().mockReturnThis();
      const mockSend = jest.fn();
      const mockReply = {
        header: mockHeader,
        send: mockSend,
      } as any;

      await controller.servePublicFile(orgId, 'sub/test.jpg', mockReply);

      expect(mockService.getFile).toHaveBeenCalledWith(
        'public',
        orgId,
        'sub/test.jpg',
      );
      expect(mockHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=31536000, immutable',
      );
      expect(mockHeader).toHaveBeenCalledWith(
        'Cross-Origin-Resource-Policy',
        'cross-origin',
      );
      expect(mockHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        '*',
      );
      expect(mockSend).toHaveBeenCalledWith(mockStream);
    });
  });

  describe('servePrivateFile (GET /v1/uploads/private/:organizationId/*)', () => {
    it('should throw forbidden error if activeOrganizationId does not match organizationId', async () => {
      const mockReply = {} as any;
      const otherOrgSession = {
        session: { activeOrganizationId: 'other-org' },
      };

      await expect(
        controller.servePrivateFile(
          orgId,
          'sub/test.pdf',
          otherOrgSession as any,
          mockReply,
        ),
      ).rejects.toThrow(BusinessError);
    });

    it('should serve private file with private cache header if organization matches', async () => {
      const mockStream = Readable.from(['bytes']) as any;

      mockService.getFile.mockResolvedValueOnce({
        objectKey: 'private/org/sub/test.pdf',
        fileName: 'test.pdf',
        body: mockStream,
      });

      const mockHeader = jest.fn().mockReturnThis();
      const mockSend = jest.fn();
      const mockReply = {
        header: mockHeader,
        send: mockSend,
      } as any;

      await controller.servePrivateFile(
        orgId,
        'sub/test.pdf',
        mockSession as any,
        mockReply,
      );

      expect(mockSend).toHaveBeenCalledWith(mockStream);

      expect(mockService.getFile).toHaveBeenCalledWith(
        'private',
        orgId,
        'sub/test.pdf',
      );
      expect(mockHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'private, no-cache, no-store, must-revalidate',
      );
      expect(mockSend).toHaveBeenCalled();
    });
  });
});
