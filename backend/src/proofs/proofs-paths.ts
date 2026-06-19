import { join, resolve } from 'node:path';

const backendRoot = process.env['BACKEND_ROOT'];
if (!backendRoot) {
  throw new Error('BACKEND_ROOT is not defined');
}

const uploadsRoot = resolve(
  backendRoot,
  process.env['UPLOADS_DIR'] ?? './uploads',
);

export const tmpUploadDir = join(uploadsRoot, 'tmp');

export function getExpenseProofDir(expenseId: string): string {
  return join(uploadsRoot, 'proofs', expenseId);
}
