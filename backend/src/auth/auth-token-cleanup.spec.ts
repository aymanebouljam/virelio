import { cleanupExpiredAuthTokens } from '../../prisma/cleanup-expired-auth-tokens';

describe('cleanupExpiredAuthTokens', () => {
  const deleteManyMock = jest.fn();
  const prisma = {
    authToken: {
      deleteMany: deleteManyMock,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('deletes only tokens expired before the supplied time', async () => {
    const now = new Date('2026-08-30T12:00:00.000Z');
    deleteManyMock.mockResolvedValueOnce({ count: 2 });

    await expect(cleanupExpiredAuthTokens(prisma, now)).resolves.toEqual({
      count: 2,
    });

    expect(deleteManyMock).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: now },
      },
    });
  });
});
