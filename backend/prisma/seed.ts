import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';
import { vendors } from './seed-data/vendors';
import { categories } from './seed-data/categories';
import { expenses } from './seed-data/expenses';
import { seedUser } from './seed-data/user';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const user = await prisma.user.create({
    data: seedUser,
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
    select: {
      id: true,
      name: true,
    },
  });

  const storedCategories = await prisma.expenseCategory.findMany({
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
    const vendorId = vendorIdByName.get(expense.vendorName);
    const categoryId = categoryIdByName.get(expense.categoryName);

    if (!vendorId) {
      throw new Error(`Missing vendor for expense seed: ${expense.vendorName}`);
    }

    if (!categoryId) {
      throw new Error(
        `Missing category for expense seed: ${expense.categoryName}`,
      );
    }

    return {
      vendorId,
      categoryId,
      description: expense.description,
      amount: expense.amount,
      expenseDate: expense.expenseDate,
      notes: expense.notes,
    };
  });

  for (const expense of expenseRows) {
    const existingExpense = await prisma.expense.findFirst({
      where: {
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
