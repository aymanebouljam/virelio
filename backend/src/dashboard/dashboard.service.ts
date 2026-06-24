import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetDashboardSummaryQueryDto } from './dto/get-dashboard-summary-query.dto';
import { Prisma } from '../../generated/prisma/client';

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
  recentActivity: Array<{
    id: string;
    type: 'expense' | 'proof';
    title: string;
    subtitle: string;
    occurredAt: string;
    expenseId: string;
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

  async getSummary(
    query: GetDashboardSummaryQueryDto,
  ): Promise<DashboardSummary> {
    const expenseDateFilter = this.buildExpenseDateFilter(query);

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
          ...expenseDateFilter,
        },
      }),
      this.prisma.proofDocument.count({
        where: {
          expense: {
            archivedAt: null,
            ...expenseDateFilter,
          },
        },
      }),
      this.prisma.expense.findMany({
        where: { archivedAt: null, ...expenseDateFilter },
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
        where: {
          expense: {
            archivedAt: null,
            ...expenseDateFilter,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          expense: {
            select: {
              id: true,
              description: true,
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

    const recentActivity = [
      ...recentExpenses.map((expense) => ({
        id: expense.id,
        type: 'expense' as const,
        title: expense.description,
        subtitle: `${expense.vendorName} · ${expense.categoryName}`,
        occurredAt: expense.expenseDate,
        expenseId: expense.id,
      })),
      ...recentProofs.map((proof) => ({
        id: proof.id,
        type: 'proof' as const,
        title: proof.originalName,
        subtitle: proof.expenseDescription,
        occurredAt: proof.createdAt,
        expenseId: proof.expenseId,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime(),
      )
      .slice(0, 8);

    return {
      totalSpend,
      activeVendors,
      uncategorizedExpenses,
      proofDocuments,
      recentExpenses,
      recentProofs,
      recentActivity,
      categoryBreakdown,
    };
  }

  private buildExpenseDateFilter(
    query: GetDashboardSummaryQueryDto,
  ): Prisma.ExpenseWhereInput {
    const { dateFrom, dateTo } = query;

    if (!dateFrom && !dateTo) {
      return {};
    }

    const expenseDate: Prisma.DateTimeFilter = {};

    if (dateFrom) {
      expenseDate.gte = new Date(dateFrom);
    }

    if (dateTo) {
      const inclusiveEnd = new Date(dateTo);
      inclusiveEnd.setUTCHours(23, 59, 59, 999);
      expenseDate.lte = inclusiveEnd;
    }
    const isValidDate = (value: unknown): value is Date =>
      value instanceof Date && !Number.isNaN(value.getTime());

    const errorShape = (description: string): never => {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'dateRange',
            constraints: {
              isValid: description,
            },
          },
        ],
      });
    };

    if (
      (expenseDate.gte !== undefined && !isValidDate(expenseDate.gte)) ||
      (expenseDate.lte !== undefined && !isValidDate(expenseDate.lte))
    ) {
      errorShape('Invalid date format');
    }

    if (
      isValidDate(expenseDate.gte) &&
      isValidDate(expenseDate.lte) &&
      expenseDate.gte.getTime() > expenseDate.lte.getTime()
    ) {
      errorShape('dateFrom must be before or equal to dateTo');
    }

    return { expenseDate };
  }
}
