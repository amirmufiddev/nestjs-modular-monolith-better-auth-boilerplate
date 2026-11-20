import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { UploadService, type FileVisibility } from '../services/upload.service';
import { BusinessError } from '@/common/errors/business-error';
import {
  AuthGuard,
  AllowAnonymous,
  Session,
} from '@thallesp/nestjs-better-auth';
import { UploadResponseDto } from '../dto/upload-response.dto';
import { ErrorResponseDto } from '@/common/dto/error-response.dto';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import * as path from 'node:path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

@ApiTags('Uploads')
@ApiExtraModels(ErrorResponseDto)
@Controller('uploads')
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  private async processUpload(
    req: FastifyRequest,
    session: UserSession,
    visibility: FileVisibility,
  ): Promise<UploadResponseDto> {
    if (!req.isMultipart()) {
      throw BusinessError.badRequest(
        'Request harus berupa multipart/form-data',
        'MULTIPART_REQUIRED',
      );
    }

    const data = await req.file();
    if (!data) {
      throw BusinessError.badRequest(
        'File tidak ditemukan dalam request',
        'FILE_NOT_FOUND',
      );
    }

    const organizationId = session?.session?.activeOrganizationId;
    if (!organizationId) {
      throw BusinessError.badRequest(
        'Anda harus memiliki organisasi aktif untuk mengunggah file.',
        'ORGANIZATION_REQUIRED',
      );
    }

    const subPath =
      (data.fields?.path as { value?: string } | undefined)?.value || undefined;

    const buffer = await data.toBuffer();
    const result = await this.uploadService.saveFile(
      {
        filename: data.filename,
        buffer,
        mimetype: data.mimetype,
      },
      visibility,
      organizationId,
      subPath,
    );

    return { url: result };
  }

  @Post('public')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Mengunggah file publik tunggal (JPG, PNG, WEBP, PDF - Max 10MB)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        path: {
          type: 'string',
          description: 'Sub-folder tujuan (opsional, contoh: media)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File publik berhasil diunggah',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Request tidak valid atau file tidak didukung / tidak ditemukan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Tidak terotentikasi',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Kesalahan internal server',
    type: ErrorResponseDto,
  })
  async uploadPublicFile(
    @Req() req: FastifyRequest,
    @Session() session: UserSession,
  ): Promise<UploadResponseDto> {
    return this.processUpload(req, session, 'public');
  }

  @Post('private')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Mengunggah file privat tunggal (JPG, PNG, WEBP, PDF - Max 10MB)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        path: {
          type: 'string',
          description: 'Sub-folder tujuan (opsional, contoh: documents)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File privat berhasil diunggah',
    type: UploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Request tidak valid atau file tidak didukung / tidak ditemukan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Tidak terotentikasi',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Kesalahan internal server',
    type: ErrorResponseDto,
  })
  async uploadPrivateFile(
    @Req() req: FastifyRequest,
    @Session() session: UserSession,
  ): Promise<UploadResponseDto> {
    return this.processUpload(req, session, 'private');
  }

  @Get('public/:organizationId/*')
  @AllowAnonymous()
  @ApiOperation({
    summary: 'Mengakses file publik yang diunggah (tanpa otentikasi)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File stream publik',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File tidak ditemukan',
    type: ErrorResponseDto,
  })
  async servePublicFile(
    @Param('organizationId') organizationId: string,
    @Param('*') filePath: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { body, fileName } = await this.uploadService.getFile(
      'public',
      organizationId,
      filePath,
    );

    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

    reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .header('Access-Control-Allow-Origin', '*')
      .header(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fileName)}"`,
      )
      .send(body);
  }

  @Get('private/:organizationId/*')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Mengakses file privat yang diunggah (hanya file milik organisasi sendiri)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File stream privat',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File tidak ditemukan',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Tidak memiliki akses ke file organisasi ini',
    type: ErrorResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Tidak terotentikasi',
    type: ErrorResponseDto,
  })
  async servePrivateFile(
    @Param('organizationId') organizationId: string,
    @Param('*') filePath: string,
    @Session() session: UserSession,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const activeOrgId = session?.session?.activeOrganizationId;

    if (activeOrgId !== organizationId) {
      throw BusinessError.forbidden(
        'Anda tidak memiliki akses ke file organisasi ini.',
        'FORBIDDEN_ORG_ACCESS',
      );
    }

    const { body, fileName } = await this.uploadService.getFile(
      'private',
      organizationId,
      filePath,
    );

    const ext = path.extname(fileName).toLowerCase();
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

    reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'private, no-cache, no-store, must-revalidate')
      .header(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(fileName)}"`,
      )
      .send(body);
  }
}
