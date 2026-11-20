import { Inject, Injectable } from '@nestjs/common';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { BusinessError } from '@/common/errors/business-error';
import { AppLoggerService } from '@/logger/logger.service';
import {
  OBJECT_STORAGE_TOKEN,
  type IObjectStorageService,
} from '../interfaces/object-storage.interface';

export type FileVisibility = 'public' | 'private';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  if (!buffer || buffer.length < 4) return false;

  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (mimetype === 'application/pdf') {
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    );
  }
  if (mimetype === 'image/webp') {
    if (buffer.length < 12) return false;
    return (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    );
  }
  return false;
}

function containsTraversal(segment: string): boolean {
  const normalized = path.normalize(segment);
  return normalized.includes('..') || path.isAbsolute(normalized);
}

function sanitizeSubPath(subPath?: string): string | undefined {
  if (!subPath) return undefined;
  const cleaned = subPath.replace(/^\/+|\/+$/g, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function joinObjectKey(...segments: string[]): string {
  return segments
    .filter((segment) => segment.length > 0)
    .join('/')
    .replace(/\/+/g, '/');
}

@Injectable()
export class UploadService {
  constructor(
    @Inject(OBJECT_STORAGE_TOKEN)
    private readonly storage: IObjectStorageService,
    private readonly logger: AppLoggerService,
  ) {}

  resolveObjectKey(
    visibility: FileVisibility,
    organizationId: string,
    filePath: string,
  ): string {
    const cleanFilePath = filePath.replace(/^\/+/, '');
    if (containsTraversal(organizationId)) {
      throw BusinessError.badRequest(
        'Organization ID mengandung karakter tidak valid.',
        'INVALID_ORGANIZATION_ID',
      );
    }
    if (containsTraversal(cleanFilePath)) {
      throw BusinessError.badRequest(
        'Path file mengandung karakter tidak valid.',
        'INVALID_FILE_PATH',
      );
    }

    return joinObjectKey(visibility, organizationId, cleanFilePath);
  }

  private resolveLegacyObjectKey(
    organizationId: string,
    filePath: string,
  ): string {
    const cleanFilePath = filePath.replace(/^\/+/, '');
    if (containsTraversal(organizationId)) {
      throw BusinessError.badRequest(
        'Organization ID mengandung karakter tidak valid.',
        'INVALID_ORGANIZATION_ID',
      );
    }
    if (containsTraversal(cleanFilePath)) {
      throw BusinessError.badRequest(
        'Path file mengandung karakter tidak valid.',
        'INVALID_FILE_PATH',
      );
    }
    return joinObjectKey(organizationId, cleanFilePath);
  }

  /** @deprecated Gunakan resolveObjectKey */
  resolveFilePath(
    visibility: FileVisibility,
    organizationId: string,
    filePath: string,
  ): string {
    return this.resolveObjectKey(visibility, organizationId, filePath);
  }

  async fileExists(
    visibility: FileVisibility,
    organizationId: string,
    filePath: string,
  ): Promise<boolean> {
    const primaryKey = this.resolveObjectKey(
      visibility,
      organizationId,
      filePath,
    );
    if (await this.storage.exists(primaryKey)) {
      return true;
    }

    if (visibility === 'private') {
      const legacyKey = this.resolveLegacyObjectKey(organizationId, filePath);
      return this.storage.exists(legacyKey);
    }

    return false;
  }

  async saveFile(
    file: { filename: string; buffer: Buffer; mimetype: string },
    visibility: FileVisibility,
    organizationId: string,
    subPath?: string,
  ): Promise<string> {
    if (!organizationId) {
      throw BusinessError.badRequest(
        'Organization ID diperlukan untuk mengunggah file. Pastikan Anda memiliki organisasi aktif.',
        'ORGANIZATION_REQUIRED',
      );
    }

    if (containsTraversal(organizationId)) {
      throw BusinessError.badRequest(
        'Organization ID mengandung karakter tidak valid.',
        'INVALID_ORGANIZATION_ID',
      );
    }

    const cleanSubPath = sanitizeSubPath(subPath);

    if (cleanSubPath && containsTraversal(cleanSubPath)) {
      throw BusinessError.badRequest(
        'Path tujuan mengandung karakter tidak valid.',
        'INVALID_UPLOAD_PATH',
      );
    }

    if (
      !ALLOWED_TYPES.includes(file.mimetype as (typeof ALLOWED_TYPES)[number])
    ) {
      throw BusinessError.badRequest(
        `Format file ${file.mimetype} tidak diizinkan. Hanya menerima JPG, PNG, WEBP, dan PDF.`,
        'INVALID_FILE_TYPE',
      );
    }

    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      throw BusinessError.badRequest(
        'Signature file (magic bytes) tidak cocok dengan mimetype yang dideklarasikan.',
        'INVALID_FILE_SIGNATURE',
      );
    }

    const fileExt = path.extname(file.filename);
    const uniqueFilename = `${randomUUID()}${fileExt}`;

    const objectKey = joinObjectKey(
      visibility,
      organizationId,
      cleanSubPath ?? '',
      uniqueFilename,
    );

    try {
      await this.storage.putObject({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });

      const urlSegments = ['/uploads', visibility, organizationId];
      if (cleanSubPath) urlSegments.push(cleanSubPath);
      urlSegments.push(uniqueFilename);
      const url = urlSegments.join('/');

      this.logger.log(
        `File uploaded successfully: ${uniqueFilename} [org=${organizationId}]`,
        {
          context: 'UploadService',
          filename: uniqueFilename,
          organizationId,
          visibility,
          objectKey,
        },
      );
      return url;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Gagal menyimpan file: ${message}`, stack, {
        context: 'UploadService',
        organizationId,
        visibility,
        filename: uniqueFilename,
        objectKey,
      });
      throw BusinessError.internal(
        'Gagal menyimpan file ke penyimpanan server.',
        'FILE_SAVE_ERROR',
      );
    }
  }

  async getFile(
    visibility: FileVisibility,
    organizationId: string,
    filePath: string,
  ): Promise<{ objectKey: string; fileName: string; body: Readable }> {
    const primaryKey = this.resolveObjectKey(
      visibility,
      organizationId,
      filePath,
    );
    if (await this.storage.exists(primaryKey)) {
      const result = await this.storage.getObject(primaryKey);
      return {
        objectKey: primaryKey,
        fileName: path.basename(filePath),
        body: result.body as Readable,
      };
    }

    if (visibility === 'private') {
      const legacyKey = this.resolveLegacyObjectKey(organizationId, filePath);
      if (await this.storage.exists(legacyKey)) {
        const result = await this.storage.getObject(legacyKey);
        return {
          objectKey: legacyKey,
          fileName: path.basename(filePath),
          body: result.body as Readable,
        };
      }
    }

    throw BusinessError.notFound('File', filePath);
  }
}
