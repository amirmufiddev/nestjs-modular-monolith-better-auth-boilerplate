import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export type FcmServiceAccount = {
  projectId: string;
  privateKey: string;
  clientEmail: string;
};

export type ResolveFcmCredentialsInput = {
  credentialsPath?: string;
  readFile?: (absolutePath: string) => string;
};

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, '\n');
}

function fromJson(raw: string): FcmServiceAccount | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const projectId =
    typeof record.project_id === 'string' ? record.project_id.trim() : '';
  const privateKey =
    typeof record.private_key === 'string' ? record.private_key : '';
  const clientEmail =
    typeof record.client_email === 'string' ? record.client_email.trim() : '';
  if (!projectId || !privateKey || !clientEmail) {
    return null;
  }
  return {
    projectId,
    privateKey: normalizePrivateKey(privateKey),
    clientEmail,
  };
}

export function resolveFcmCredentials(
  input: ResolveFcmCredentialsInput,
): FcmServiceAccount | null {
  const credentialsPath = input.credentialsPath?.trim() ?? '';
  if (!credentialsPath) {
    return null;
  }
  const absolutePath = isAbsolute(credentialsPath)
    ? credentialsPath
    : resolve(process.cwd(), credentialsPath);
  try {
    const read = input.readFile ?? ((p) => readFileSync(p, 'utf8'));
    return fromJson(read(absolutePath));
  } catch {
    return null;
  }
}
