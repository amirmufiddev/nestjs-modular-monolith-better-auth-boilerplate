import { Module } from '@nestjs/common';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { S3ObjectStorageAdapter } from './adapters/s3-object-storage.adapter';
import { OBJECT_STORAGE_TOKEN } from './interfaces/object-storage.interface';

@Module({
  controllers: [UploadController],
  providers: [
    UploadService,
    {
      provide: OBJECT_STORAGE_TOKEN,
      useClass: S3ObjectStorageAdapter,
    },
  ],
  exports: [UploadService, OBJECT_STORAGE_TOKEN],
})
export class UploadModule {}
