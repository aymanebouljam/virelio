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
import { createSeedUser } from './seed-data/user';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const seedUser = await createSeedUser();
  const user = await prisma.user.upsert({
    where: {
      email: seedUser.email,
    },
    update: seedUser,
    create: seedUser,
  });
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
    const proofDirectory = getExpenseProofDir(expenseId);
    const storagePath = `uploads/proofs/${expenseId}/${proof.originalName}`;
    const sizeBytes = Buffer.byteLength(proof.content);

    await mkdir(proofDirectory, { recursive: true });
    await writeFile(join(proofDirectory, proof.originalName), proof.content);

    const existingProof = await prisma.proofDocument.findFirst({
      where: {
        expenseId,
        originalName: proof.originalName,
      },
      select: {
        id: true,
      },
    });

    if (!existingProof) {
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
