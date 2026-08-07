import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetExpenseReportQueryDto } from './dto/get-expense-report-query.dto';

export type ExpenseReport = {
  totalAmount: string;
  expenseCount: number;
  categoryTotals: Array<{
    categoryId: string | null;
    categoryName: string;
    totalAmount: string;
    expenseCount: number;
  }>;
  expenses: {
    items: Array<{
      id: string;
      description: string;
      amount: string;
      expenseDate: string;
      vendorId: string;
      vendorName: string;
      categoryId: string | null;
      categoryName: string;
      notes: string | null;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  };
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getExpenseReport(
    userId: string,
    query: GetExpenseReportQueryDto = {},
  ): Promise<ExpenseReport> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const expenseDateFilter = this.buildExpenseDateFilter(query);
    const where = {
      userId,
      archivedAt: null,
      ...expenseDateFilter,
    };

    const [totals, categoryGroups, expenses] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.expense.findMany({
        where,
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
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const categoryIds = categoryGroups.flatMap((group) =>
      group.categoryId ? [group.categoryId] : [],
    );
    const categories =
      categoryIds.length > 0
        ? await this.prisma.expenseCategory.findMany({
            where: { userId, id: { in: categoryIds } },
            select: { id: true, name: true },
          })
        : [];
    const categoryNameById = new Map(
      categories.map((category) => [category.id, category.name]),
    );
    const categoryTotals = categoryGroups
      .map((entry) => ({
        categoryId: entry.categoryId,
        categoryName: this.resolveCategoryName(
          entry.categoryId,
          categoryNameById,
        ),
        totalAmount: entry._sum.amount?.toNumber() ?? 0,
        expenseCount: entry._count._all,
      }))
      .sort(
        (left, right) =>
          right.totalAmount - left.totalAmount ||
          left.categoryName.localeCompare(right.categoryName),
      )
      .map((entry) => ({
        ...entry,
        totalAmount: entry.totalAmount.toFixed(2),
      }));
    const expenseCount = totals._count._all;

    return {
      totalAmount: (totals._sum.amount?.toNumber() ?? 0).toFixed(2),
      expenseCount,
      categoryTotals,
      expenses: {
        items: expenses.map((expense) => ({
          id: expense.id,
          description: expense.description,
          amount: expense.amount.toNumber().toFixed(2),
          expenseDate: expense.expenseDate.toISOString(),
          vendorId: expense.vendor.id,
          vendorName: expense.vendor.name,
          categoryId: expense.category?.id ?? null,
          categoryName: expense.category?.name ?? 'Uncategorized',
          notes: expense.notes ?? null,
        })),
        pagination: {
          page,
          pageSize,
          totalItems: expenseCount,
          totalPages: Math.ceil(expenseCount / pageSize),
        },
      },
    };
  }

  private buildExpenseDateFilter(
    query: GetExpenseReportQueryDto,
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

    if (
      (expenseDate.gte !== undefined && !isValidDate(expenseDate.gte)) ||
      (expenseDate.lte !== undefined && !isValidDate(expenseDate.lte))
    ) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'dateRange',
            constraints: {
              isValid: 'Invalid date format',
            },
          },
        ],
      });
    }

    if (
      isValidDate(expenseDate.gte) &&
      isValidDate(expenseDate.lte) &&
      expenseDate.gte.getTime() > expenseDate.lte.getTime()
    ) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'dateRange',
            constraints: {
              isValid: 'Date From must be before or equal to date To',
            },
          },
        ],
      });
    }

    return { expenseDate };
  }

  private resolveCategoryName(
    categoryId: string | null,
    categoryNameById: Map<string, string>,
  ): string {
    if (categoryId === null) {
      return 'Uncategorized';
    }

    const categoryName = categoryNameById.get(categoryId);
    if (!categoryName) {
      throw new Error(`Missing category for report group: ${categoryId}`);
    }

    return categoryName;
  }
}
