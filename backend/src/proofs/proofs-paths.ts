import { isAbsolute, join } from 'node:path';

export function getBackendRoot(): string {
  return process.env['BACKEND_ROOT'] ?? process.cwd();
}

export function getUploadsRoot(): string {
  const uploadsDir = process.env['UPLOADS_DIR'] ?? 'uploads';

  if (isAbsolute(uploadsDir)) {
    throw new Error('UPLOADS_DIR must be relative to BACKEND_ROOT');
  }

  return join(getBackendRoot(), uploadsDir);
}

export function getTmpUploadDir(): string {
  return join(getUploadsRoot(), 'tmp');
}

export function getExpenseProofDir(expenseId: string): string {
  return join(getUploadsRoot(), 'proofs', expenseId);
}
