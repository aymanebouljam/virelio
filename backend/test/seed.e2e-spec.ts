import type { INestApplication } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PrismaService } from '../prisma/prisma.service';
import { categories as categorySeeds } from '../prisma/seed-data/categories';
import { expenses as expenseSeeds } from '../prisma/seed-data/expenses';
import { proofs as proofSeeds } from '../prisma/seed-data/proofs';
import { seedUserEmail } from '../prisma/seed-data/user';
import { vendors as vendorSeeds } from '../prisma/seed-data/vendors';
import { createTestApp, resetDatabase } from './test-app';

const execFileAsync = promisify(execFile);

describe('Development seed e2e', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadsRoot: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    uploadsRoot = await mkdtemp(join(tmpdir(), 'virelio-seed-'));
  });

  afterEach(async () => {
    await resetDatabase(prisma);
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('leaves seeded records and proof files unchanged on repeat runs', async () => {
    await runSeed();
    const firstSnapshot = await getSeedSnapshot();

    expect(firstSnapshot.vendors).toHaveLength(vendorSeeds.length);
    expect(firstSnapshot.categories).toHaveLength(categorySeeds.length);
    expect(firstSnapshot.expenses).toHaveLength(expenseSeeds.length);
    expect(firstSnapshot.proofs).toHaveLength(proofSeeds.length);

    await runSeed();

    expect(await getSeedSnapshot()).toEqual(firstSnapshot);
  }, 30_000);

  async function runSeed() {
    await execFileAsync(
      process.execPath,
      ['--import', 'tsx', './prisma/seed.ts'],
      {
        cwd: join(__dirname, '..'),
        env: {
          ...process.env,
          BACKEND_ROOT: uploadsRoot,
          UPLOADS_DIR: 'uploads',
        },
      },
    );
  }

  async function getSeedSnapshot() {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: seedUserEmail },
    });
    const [vendors, categories, expenses, proofs] = await Promise.all([
      prisma.vendor.findMany({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
      }),
      prisma.expenseCategory.findMany({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
      }),
      prisma.expense.findMany({
        where: { userId: user.id },
        orderBy: { id: 'asc' },
      }),
      prisma.proofDocument.findMany({
        where: { expense: { userId: user.id } },
        orderBy: { id: 'asc' },
      }),
    ]);
    const proofFiles = await Promise.all(
      proofs.map(async (proof) => ({
        storagePath: proof.storagePath,
        content: await readFile(join(uploadsRoot, proof.storagePath), 'utf8'),
        modifiedAt: (await stat(join(uploadsRoot, proof.storagePath))).mtimeMs,
      })),
    );

    return { user, vendors, categories, expenses, proofs, proofFiles };
  }
});
