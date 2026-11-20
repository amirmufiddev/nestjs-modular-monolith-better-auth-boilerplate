import { buildUploadConfig } from './upload.config';
import type { EnvConfig } from './env.validation';

describe('upload config', () => {
  it('should map S3 env vars to upload config', () => {
    const env = {
      S3_ENDPOINT: 'http://127.0.0.1:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'key',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_BUCKET: 'my-bucket',
      S3_FORCE_PATH_STYLE: true,
    } as Pick<
      EnvConfig,
      | 'S3_ENDPOINT'
      | 'S3_REGION'
      | 'S3_ACCESS_KEY_ID'
      | 'S3_SECRET_ACCESS_KEY'
      | 'S3_BUCKET'
      | 'S3_FORCE_PATH_STYLE'
    >;

    expect(buildUploadConfig(env as EnvConfig)).toEqual({
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      bucket: 'my-bucket',
      forcePathStyle: true,
    });
  });
});
