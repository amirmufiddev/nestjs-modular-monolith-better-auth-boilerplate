export const OBJECT_STORAGE_TOKEN = Symbol('OBJECT_STORAGE_TOKEN');

export interface PutObjectOptions {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface GetObjectResult {
  body: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
}

export interface IObjectStorageService {
  putObject(options: PutObjectOptions): Promise<{ key: string; url?: string }>;
  getObject(key: string): Promise<GetObjectResult>;
  deleteObject(key: string): Promise<void>;
  getSignedDownloadUrl?(key: string, expiresInSeconds: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
