import { PrismaPg } from '@prisma/adapter-pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { getExpenseProofDir } from '../src/proofs/proofs-paths';
import 'dotenv/config';
import { vendors } from './seed-data/vendors';
import { categories } from './seed-data/categories';
import { expenses } from './seed-data/expenses';
import { proofs } from './seed-data/proofs';
import { createSeedUser, seedUserEmail } from './seed-data/user';
import { relativeDate } from './seed-data/dates';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});

const prisma = new PrismaClient({ adapter });

const recurringExpenseTemplates = [
  {
    vendorName: 'CloudPoint Hosting',
    categoryName: 'Utilities',
    description: 'Cloud infrastructure subscription',
    amount: '2245.00',
    currency: 'USD',
    frequency: 'MONTHLY' as const,
    nextDueDate: relativeDate(-2),
    notes: 'Monthly hosting, storage, and infrastructure services.',
  },
  {
    vendorName: 'Green Market Foods',
    categoryName: 'Food',
    description: 'Office pantry delivery',
    amount: '680.25',
    currency: 'USD',
    frequency: 'MONTHLY' as const,
    nextDueDate: relativeDate(5),
    notes: 'Monthly snacks, coffee, and refreshments delivery.',
  },
  {
    vendorName: 'Legacy Telecom Services',
    categoryName: 'Legacy communications',
    description: 'Office telephone service',
    amount: '980.00',
    currency: 'USD',
    frequency: 'MONTHLY' as const,
    nextDueDate: relativeDate(-45),
    notes: 'Retired telephone service agreement.',
    archivedAt: relativeDate(-30),
  },
  {
    vendorName: 'PixelCraft Agency',
    categoryName: 'Marketing',
    description: 'Seasonal campaign retainer',
    amount: '1500.00',
    currency: 'USD',
    frequency: 'MONTHLY' as const,
    nextDueDate: relativeDate(-60),
    notes: 'Retired campaign support arrangement.',
    archivedAt: relativeDate(-21),
  },
];

async function main() {
  const existingUser = await prisma.user.findUnique({
    where: { email: seedUserEmail },
  });

  const user =
    existingUser ??
    (await prisma.user.create({
      data: await createSeedUser(),
    }));

  await prisma.vendor.createMany({
    data: vendors.map((vendor) => ({
      ...vendor,
      userId: user.id,
    })),
    skipDuplicates: true,
  });

  await prisma.expenseCategory.createMany({
    data: categories.map((category) => ({
      ...category,
      userId: user.id,
    })),
    skipDuplicates: true,
  });

  const storedVendors = await prisma.vendor.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const storedCategories = await prisma.expenseCategory.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
    },
  });

  const vendorIdByName = new Map(
    storedVendors.map((vendor) => [vendor.name, vendor.id]),
  );
  const categoryIdByName = new Map(
    storedCategories.map((category) => [category.name, category.id]),
  );

  const expenseRows = expenses.map((expense) => {
    const { vendorName, categoryName, ...data } = expense;
    const vendorId = vendorIdByName.get(vendorName);
    const categoryId = categoryIdByName.get(categoryName);

    if (!vendorId) {
      throw new Error(`Missing vendor for expense seed: ${vendorName}`);
    }

    if (!categoryId) {
      throw new Error(`Missing category for expense seed: ${categoryName}`);
    }

    return {
      vendorId,
      categoryId,
      ...data,
    };
  });

  const recurringExpenseRows = recurringExpenseTemplates.map((template) => {
    const { vendorName, categoryName, ...data } = template;
    const vendorId = vendorIdByName.get(vendorName);
    const categoryId = categoryIdByName.get(categoryName);

    if (!vendorId) {
      throw new Error(
        `Missing vendor for recurring expense seed: ${vendorName}`,
      );
    }

    if (!categoryId) {
      throw new Error(
        `Missing category for recurring expense seed: ${categoryName}`,
      );
    }

    return {
      vendorId,
      categoryId,
      ...data,
    };
  });

  for (const expense of expenseRows) {
    const existingExpense = await prisma.expense.findFirst({
      where: {
        userId: user.id,
        vendorId: expense.vendorId,
        categoryId: expense.categoryId,
        description: expense.description,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
      },
      select: {
        id: true,
      },
    });

    if (!existingExpense) {
      await prisma.expense.create({
        data: {
          userId: user.id,
          ...expense,
        },
      });
    }
  }

  for (const template of recurringExpenseRows) {
    const existingTemplate = await prisma.recurringExpenseTemplate.findFirst({
      where: {
        userId: user.id,
        vendorId: template.vendorId,
        categoryId: template.categoryId,
        description: template.description,
        amount: template.amount,
        frequency: template.frequency,
      },
      select: {
        id: true,
      },
    });

    if (!existingTemplate) {
      await prisma.recurringExpenseTemplate.create({
        data: {
          userId: user.id,
          ...template,
        },
      });
    }
  }

  for (const proof of proofs) {
    const expense = await prisma.expense.findFirst({
      where: {
        userId: user.id,
        description: proof.expenseDescription,
        expenseDate: proof.expenseDate,
      },
      select: {
        id: true,
      },
    });

    if (!expense) {
      throw new Error(
        `Missing expense for proof seed: ${proof.expenseDescription}`,
      );
    }
    const expenseId = expense.id;

    const existingProof = await prisma.proofDocument.findFirst({
      where: {
        expenseId,
        originalName: proof.originalName,
      },
      select: {
        id: true,
      },
    });

    if (existingProof) continue;

    const proofDirectory = getExpenseProofDir(expenseId);
    const storagePath = join(proofDirectory, proof.originalName);
    const sizeBytes = Buffer.byteLength(proof.content);

    await mkdir(proofDirectory, { recursive: true });
    await writeFile(storagePath, proof.content);

    await prisma.proofDocument.create({
      data: {
        expenseId,
        originalName: proof.originalName,
        mimeType: 'text/plain',
        sizeBytes,
        storagePath,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
