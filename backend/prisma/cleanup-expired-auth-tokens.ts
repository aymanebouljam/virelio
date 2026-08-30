type AuthTokenCleanupPrisma = {
  authToken: {
    deleteMany(args: {
      where: {
        expiresAt: {
          lt: Date;
        };
      };
    }): Promise<{ count: number }>;
  };
};

export function cleanupExpiredAuthTokens(
  prisma: AuthTokenCleanupPrisma,
  now = new Date(),
) {
  return prisma.authToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  });
}
