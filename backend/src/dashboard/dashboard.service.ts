import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetDashboardSummaryQueryDto } from './dto/get-dashboard-summary-query.dto';
import { Prisma } from '../../generated/prisma/client';

const CATEGORY_BREAKDOWN_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 6;

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
    userId: string,
    query: GetDashboardSummaryQueryDto = {},
  ): Promise<DashboardSummary> {
    const dateFilter = this.buildDateFilter(query);
    const expenseDateFilter =
      Object.keys(dateFilter).length > 0 ? { expenseDate: dateFilter } : {};
    const proofDateFilter =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    const [
      activeVendors,
      uncategorizedExpenses,
      proofDocuments,
      expenses,
      proofs,
    ] = await Promise.all([
      this.prisma.vendor.count({
        where: { userId, archivedAt: null },
      }),
      this.prisma.expense.count({
        where: {
          userId,
          archivedAt: null,
          categoryId: null,
        },
      }),
      this.prisma.proofDocument.count({
        where: {
          ...proofDateFilter,
          expense: {
            userId,
            archivedAt: null,
          },
        },
      }),
      this.prisma.expense.findMany({
        where: { userId, archivedAt: null, ...expenseDateFilter },
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
          ...proofDateFilter,
          expense: {
            userId,
            archivedAt: null,
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

    const categoriesBySpend = [...categoryBreakdownMap.values()].sort(
      (left, right) => right.totalAmount - left.totalAmount,
    );
    const visibleCategories = categoriesBySpend.slice(
      0,
      CATEGORY_BREAKDOWN_LIMIT,
    );
    const remainingCategories = categoriesBySpend.slice(
      CATEGORY_BREAKDOWN_LIMIT,
    );

    if (remainingCategories.length > 0) {
      const otherTotals = remainingCategories.reduce(
        (totals, category) => ({
          totalAmount: totals.totalAmount + category.totalAmount,
          expenseCount: totals.expenseCount + category.expenseCount,
        }),
        { totalAmount: 0, expenseCount: 0 },
      );

      visibleCategories.push({
        categoryId: null,
        categoryName: 'Other',
        ...otherTotals,
      });
    }

    const categoryBreakdown = visibleCategories.map((entry) => ({
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
      .slice(0, RECENT_ACTIVITY_LIMIT);

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

  private buildDateFilter(
    query: GetDashboardSummaryQueryDto,
  ): Prisma.DateTimeFilter {
    const { dateFrom, dateTo } = query;

    if (!dateFrom && !dateTo) {
      return {};
    }

    const filterDate: Prisma.DateTimeFilter = {};

    if (dateFrom) {
      filterDate.gte = new Date(dateFrom);
    }

    if (dateTo) {
      const inclusiveEnd = new Date(dateTo);
      inclusiveEnd.setUTCHours(23, 59, 59, 999);
      filterDate.lte = inclusiveEnd;
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
      (filterDate.gte !== undefined && !isValidDate(filterDate.gte)) ||
      (filterDate.lte !== undefined && !isValidDate(filterDate.lte))
    ) {
      errorShape('Invalid date format');
    }

    if (
      isValidDate(filterDate.gte) &&
      isValidDate(filterDate.lte) &&
      filterDate.gte.getTime() > filterDate.lte.getTime()
    ) {
      errorShape('Date From must be before or equal to date To');
    }

    return filterDate;
  }
}
