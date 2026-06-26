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
  expenses: Array<{
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
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getExpenseReport(
    query: GetExpenseReportQueryDto = {},
  ): Promise<ExpenseReport> {
    const expenseDateFilter = this.buildExpenseDateFilter(query);

    const expenses = await this.prisma.expense.findMany({
      where: {
        archivedAt: null,
        ...expenseDateFilter,
      },
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
    });

    const totalAmount = expenses
      .reduce((sum, expense) => sum + expense.amount.toNumber(), 0)
      .toFixed(2);

    const categoryTotalsMap = new Map<
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

      const existing = categoryTotalsMap.get(key);
      if (existing) {
        existing.totalAmount += amount;
        existing.expenseCount += 1;
        continue;
      }

      categoryTotalsMap.set(key, {
        categoryId,
        categoryName,
        totalAmount: amount,
        expenseCount: 1,
      });
    }

    const categoryTotals = [...categoryTotalsMap.values()]
      .sort((left, right) => right.totalAmount - left.totalAmount)
      .map((entry) => ({
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        totalAmount: entry.totalAmount.toFixed(2),
        expenseCount: entry.expenseCount,
      }));

    return {
      totalAmount,
      expenseCount: expenses.length,
      categoryTotals,
      expenses: expenses.map((expense) => ({
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
    };
  }

  private buildExpenseDateFilter(
    query: GetExpenseReportQueryDto = {},
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
              isValid: 'dateFrom must be before or equal to dateTo',
            },
          },
        ],
      });
    }

    return { expenseDate };
  }
}
