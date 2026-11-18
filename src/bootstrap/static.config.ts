import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

/**
 * Static file serving dinonaktifkan karena file upload sekarang
 * dilayani melalui endpoint authenticated di UploadController.
 *
 * File yang diupload tersimpan di uploads/{organizationId}/{path}
 * dan hanya bisa diakses oleh user yang login dengan organisasi yang sesuai
 * melalui GET /v1/uploads/:organizationId/*
 */

export async function configureStatic(
  _app: NestFastifyApplication,

  _config: ConfigService,
): Promise<void> {
  // Intentionally disabled — uploads served via authenticated controller
}
