import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { UploadModule } from './upload.module';
import { UploadController } from './controllers/upload.controller';
import { UploadService } from './services/upload.service';
import { OBJECT_STORAGE_TOKEN } from './interfaces/object-storage.interface';
import { S3ObjectStorageAdapter } from './adapters/s3-object-storage.adapter';
import { AppLoggerService } from '@/logger/logger.service';
import { LoggerModule } from '@/logger/logger.module';

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    if (key === 'upload') {
      return {
        endpoint: 'http://127.0.0.1:9000',
        region: 'us-east-1',
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
        bucket: 'uploads',
        forcePathStyle: true,
      };
    }
    return undefined;
  }),
};

const mockLogger = {
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const controllerGuard = (
  Reflect.getMetadata('__guards__', UploadController) as any[]
)?.[0];
const guardDeps = controllerGuard
  ? ((Reflect.getMetadata('self:paramtypes', controllerGuard) as any[]) ?? [])
  : [];
const authOptionsToken = guardDeps.find((p) => p.index === 1)?.param;

const extraProviders: any[] = [Reflector];
if (authOptionsToken) {
  extraProviders.push({
    provide: authOptionsToken,
    useValue: {
      auth: {
        options: { basePath: '/api/auth' },
        api: { getSession: jest.fn() },
      },
    },
  });
}

@Global()
@Module({
  providers: [
    ...extraProviders,
    {
      provide: ConfigService,
      useValue: mockConfigService,
    },
    {
      provide: AppLoggerService,
      useValue: mockLogger,
    },
  ],
  exports: [
    ...extraProviders.map((p) => (p.provide ? p.provide : p)),
    ConfigService,
    AppLoggerService,
  ],
})
class TestInfraModule {}

describe('UploadModule', () => {
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, UploadModule],
    }).compile();
  });

  it('should be defined and compile successfully', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should resolve UploadController', () => {
    const controller = moduleRef.get<UploadController>(UploadController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(UploadController);
  });

  it('should resolve UploadService', () => {
    const service = moduleRef.get<UploadService>(UploadService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(UploadService);
  });

  it('should resolve OBJECT_STORAGE_TOKEN as S3ObjectStorageAdapter', () => {
    const storage = moduleRef.get(OBJECT_STORAGE_TOKEN);
    expect(storage).toBeDefined();
    expect(storage).toBeInstanceOf(S3ObjectStorageAdapter);
  });

  it('should compile cleanly with ConfigModule and LoggerModule', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [
        TestInfraModule,
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              upload: {
                endpoint: 'http://127.0.0.1:9000',
                region: 'us-east-1',
                accessKeyId: 'minioadmin',
                secretAccessKey: 'minioadmin',
                bucket: 'uploads',
                forcePathStyle: true,
              },
            }),
          ],
        }),
        LoggerModule,
        UploadModule,
      ],
    }).compile();

    expect(testingModule).toBeDefined();
    expect(testingModule.get(UploadService)).toBeDefined();
    expect(testingModule.get(OBJECT_STORAGE_TOKEN)).toBeInstanceOf(
      S3ObjectStorageAdapter,
    );
  });
});
