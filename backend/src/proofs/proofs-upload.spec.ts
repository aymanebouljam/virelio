import {
  DEFAULT_PROOF_UPLOAD_MAX_BYTES,
  getProofUploadMaxBytes,
} from './proofs-upload';

describe('proof upload configuration', () => {
  it('uses a ten-megabyte default upload limit', () => {
    expect(getProofUploadMaxBytes(undefined)).toBe(
      DEFAULT_PROOF_UPLOAD_MAX_BYTES,
    );
  });

  it('uses a configured positive byte limit', () => {
    expect(getProofUploadMaxBytes('5242880')).toBe(5 * 1024 * 1024);
  });

  it.each(['', '0', '-1', '1.5', 'not-a-number'])(
    'rejects the invalid upload limit %p',
    (configuredValue) => {
      expect(() => getProofUploadMaxBytes(configuredValue)).toThrow(
        'PROOF_UPLOAD_MAX_BYTES must be a positive integer',
      );
    },
  );
});
