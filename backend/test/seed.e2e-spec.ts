import type { INestApplication } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PrismaService } from '../prisma/prisma.service';
import { categories as categorySeeds } from '../prisma/seed-data/categories';
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
    expect(firstSnapshot.expenses).toHaveLength(23);
    expect(
      firstSnapshot.expenses.filter((expense) => expense.archivedAt === null),
    ).toHaveLength(20);
    expect(
      firstSnapshot.expenses.filter((expense) => expense.categoryId !== null),
    ).toHaveLength(17);
    expect(firstSnapshot.proofs).toHaveLength(18);
    const dueToday = new Date();
    dueToday.setUTCHours(0, 0, 0, 0);
    const dueSoon = new Date(dueToday);
    dueSoon.setUTCDate(dueSoon.getUTCDate() + 7);
    expect(
      firstSnapshot.recurringExpenseTemplates.filter(
        (template) =>
          template.archivedAt === null &&
          template.nextDueDate >= dueToday &&
          template.nextDueDate <= dueSoon,
      ),
    ).toHaveLength(2);
    const proofExpenseIds = new Set(
      firstSnapshot.proofs.map((proof) => proof.expenseId),
    );
    expect(proofExpenseIds.size).toBe(proofSeeds.length);
    expect(
      firstSnapshot.expenses.filter(
        (expense) =>
          expense.categoryId === null && !proofExpenseIds.has(expense.id),
      ),
    ).toHaveLength(5);

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
    const [vendors, categories, expenses, recurringExpenseTemplates, proofs] =
      await Promise.all([
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
        prisma.recurringExpenseTemplate.findMany({
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
        content: await readFile(proof.storagePath, 'utf8'),
        modifiedAt: (await stat(proof.storagePath)).mtimeMs,
      })),
    );

    return {
      user,
      vendors,
      categories,
      expenses,
      recurringExpenseTemplates,
      proofs,
      proofFiles,
    };
  }
});
