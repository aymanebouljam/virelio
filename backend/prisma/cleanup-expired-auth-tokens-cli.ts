import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';
import { cleanupExpiredAuthTokens } from './cleanup-expired-auth-tokens';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const { count } = await cleanupExpiredAuthTokens(prisma);
  console.log(`Deleted ${count} expired authentication tokens.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
