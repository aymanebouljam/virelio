export const DEFAULT_PROOF_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function getProofUploadMaxBytes(
  configuredValue: string | undefined,
): number {
  if (configuredValue === undefined) {
    return DEFAULT_PROOF_UPLOAD_MAX_BYTES;
  }

  const maxBytes = Number(configuredValue);
  if (
    !/^\d+$/.test(configuredValue) ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new Error('PROOF_UPLOAD_MAX_BYTES must be a positive integer');
  }

  return maxBytes;
}
