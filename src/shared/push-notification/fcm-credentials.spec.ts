import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveFcmCredentials } from './fcm-credentials';

describe('resolveFcmCredentials', () => {
  it('should return null when credentials path is empty', () => {
    expect(resolveFcmCredentials({})).toBeNull();
    expect(resolveFcmCredentials({ credentialsPath: '   ' })).toBeNull();
  });

  it('should load project_id, private_key, and client_email from a JSON file path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-creds-'));
    const credentialsPath = join(dir, 'service-account.json');
    writeFileSync(
      credentialsPath,
      JSON.stringify({
        project_id: 'example-app',
        private_key:
          '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
        client_email: 'firebase-adminsdk@example-app.iam.gserviceaccount.com',
      }),
    );

    expect(resolveFcmCredentials({ credentialsPath })).toEqual({
      projectId: 'example-app',
      privateKey:
        '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
      clientEmail: 'firebase-adminsdk@example-app.iam.gserviceaccount.com',
    });
  });

  it('should return null when JSON file is missing required fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fcm-creds-'));
    const credentialsPath = join(dir, 'bad.json');
    writeFileSync(credentialsPath, JSON.stringify({ project_id: 'only' }));

    expect(resolveFcmCredentials({ credentialsPath })).toBeNull();
  });

  it('should return null when the JSON file does not exist', () => {
    expect(
      resolveFcmCredentials({
        credentialsPath: '/tmp/example-missing-fcm.json',
      }),
    ).toBeNull();
  });
});
