import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type DashboardSummary = {
  totalSpend: string;
  activeVendors: number;
  uncategorizedExpenses: number;
  proofDocuments: number;
  recentExpenses: Array<{
    id: string;
    description: string;
    amount: string;
    expenseDate: string;
    vendorId: string;
    vendorName: string;
    categoryName: string;
  }>;
  recentProofs: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    storagePath: string;
    expenseId: string;
    expenseDescription: string;
  }>;
  categoryBreakdown: Array<{
    categoryId: string | null;
    categoryName: string;
    totalAmount: string;
    expenseCount: number;
  }>;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummary> {
    const [
      activeVendors,
      uncategorizedExpenses,
      proofDocuments,
      expenses,
      proofs,
    ] = await Promise.all([
      this.prisma.vendor.count({
        where: { archivedAt: null },
      }),
      this.prisma.expense.count({
        where: {
          archivedAt: null,
          categoryId: null,
        },
      }),
      this.prisma.proofDocument.count({
        where: {
          expense: {
            archivedAt: null,
          },
        },
      }),
      this.prisma.expense.findMany({
        where: { archivedAt: null },
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          expenseDate: 'desc',
        },
      }),
      this.prisma.proofDocument.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          expense: {
            select: {
              id: true,
              description: true,
              archivedAt: true,
            },
          },
        },
      }),
    ]);

    const totalSpend = expenses
      .reduce((sum, expense) => sum + expense.amount.toNumber(), 0)
      .toFixed(2);

    const recentExpenses = expenses.slice(0, 5).map((expense) => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount.toNumber().toFixed(2),
      expenseDate: expense.expenseDate.toISOString(),
      vendorId: expense.vendor.id,
      vendorName: expense.vendor.name,
      categoryName: expense.category?.name ?? 'Uncategorized',
    }));

    const recentProofs = proofs.map((proof) => ({
      id: proof.id,
      originalName: proof.originalName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      storagePath: proof.storagePath,
      createdAt: proof.createdAt.toISOString(),
      expenseId: proof.expense.id,
      expenseDescription: proof.expense.description,
    }));

    const categoryBreakdownMap = new Map<
      string,
      {
        categoryId: string | null;
        categoryName: string;
        totalAmount: number;
        expenseCount: number;
      }
    >();

    for (const expense of expenses) {
      const categoryId = expense.category?.id ?? null;
      const categoryName = expense.category?.name ?? 'Uncategorized';
      const key = categoryId ?? 'uncategorized';
      const amount = expense.amount.toNumber();

      const existing = categoryBreakdownMap.get(key);
      if (existing) {
        existing.totalAmount += amount;
        existing.expenseCount += 1;
        continue;
      }

      categoryBreakdownMap.set(key, {
        categoryId,
        categoryName,
        totalAmount: amount,
        expenseCount: 1,
      });
    }

    const categoryBreakdown = [...categoryBreakdownMap.values()]
      .sort((left, right) => right.totalAmount - left.totalAmount)
      .map((entry) => ({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        totalAmount: entry.totalAmount.toFixed(2),
        expenseCount: entry.expenseCount,
      }));

    return {
      totalSpend,
      activeVendors,
      uncategorizedExpenses,
      proofDocuments,
      recentExpenses,
      recentProofs,
      categoryBreakdown,
    };
  }
}
