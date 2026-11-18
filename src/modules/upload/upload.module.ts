import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { UploadConfig } from '@/config/upload.config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { S3ObjectStorageService } from './infrastructure/s3-object-storage.service';
import { S3_CLIENT } from './upload.tokens';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const upload = configService.get<UploadConfig>('upload', {
          infer: true,
        });
        if (!upload) {
          throw new Error('Upload config tidak tersedia');
        }
        return new S3Client({
          endpoint: upload.endpoint,
          region: upload.region,
          credentials: {
            accessKeyId: upload.accessKeyId,
            secretAccessKey: upload.secretAccessKey,
          },
          forcePathStyle: upload.forcePathStyle,
        });
      },
    },
    S3ObjectStorageService,
    UploadService,
  ],
  exports: [UploadService],
})
export class UploadModule {}
