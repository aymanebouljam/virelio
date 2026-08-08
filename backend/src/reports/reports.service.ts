import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetExpenseReportQueryDto } from './dto/get-expense-report-query.dto';
import { GetReportInsightsQueryDto } from './dto/get-report-insights-query.dto';
import { GetReportDateRangeQueryDto } from './dto/get-report-date-range-query.dto';

type ReportDateQuery = {
  dateFrom?: string;
  dateTo?: string;
};

type ExpenseDateRange = {
  gte?: Date;
  lte?: Date;
};

type MonthlyTotalRow = {
  month: string;
  totalAmount: Prisma.Decimal;
  expenseCount: number;
};

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

export type ReportInsights = {
  monthlyTotals: Array<{
    month: string;
    totalAmount: string;
    expenseCount: number;
  }>;
  vendorTotals: Array<{
    vendorId: string;
    vendorName: string;
    totalAmount: string;
    expenseCount: number;
  }>;
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
    const expenseDateRange = this.buildExpenseDateRange(query);
    const where = {
      userId,
      archivedAt: null,
      ...(expenseDateRange && { expenseDate: expenseDateRange }),
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

  async getReportInsights(
    userId: string,
    query: GetReportInsightsQueryDto = {},
  ): Promise<ReportInsights> {
    const expenseDateRange = this.buildExpenseDateRange(query);
    const where = {
      userId,
      archivedAt: null,
      ...(expenseDateRange && { expenseDate: expenseDateRange }),
    };
    const monthlyConditions = [
      Prisma.sql`"userId" = ${userId}`,
      Prisma.sql`"archivedAt" IS NULL`,
    ];

    if (expenseDateRange?.gte) {
      monthlyConditions.push(
        Prisma.sql`"expenseDate" >= ${expenseDateRange.gte}`,
      );
    }

    if (expenseDateRange?.lte) {
      monthlyConditions.push(
        Prisma.sql`"expenseDate" <= ${expenseDateRange.lte}`,
      );
    }

    const [monthlyTotals, vendorGroups] = await Promise.all([
      this.prisma.$queryRaw<MonthlyTotalRow[]>(Prisma.sql`
        SELECT
          to_char(date_trunc('month', "expenseDate"), 'YYYY-MM') AS month,
          SUM(amount) AS "totalAmount",
          COUNT(*)::integer AS "expenseCount"
        FROM "Expense"
        WHERE ${Prisma.join(monthlyConditions, ' AND ')}
        GROUP BY date_trunc('month', "expenseDate")
        ORDER BY date_trunc('month', "expenseDate") ASC
      `),
      this.prisma.expense.groupBy({
        by: ['vendorId'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const vendorIds = vendorGroups.map((group) => group.vendorId);
    const vendors =
      vendorIds.length > 0
        ? await this.prisma.vendor.findMany({
            where: { userId, id: { in: vendorIds } },
            select: { id: true, name: true },
          })
        : [];
    const vendorNameById = new Map(
      vendors.map((vendor) => [vendor.id, vendor.name]),
    );

    return {
      monthlyTotals: monthlyTotals.map((total) => ({
        month: total.month,
        totalAmount: total.totalAmount.toNumber().toFixed(2),
        expenseCount: total.expenseCount,
      })),
      vendorTotals: vendorGroups
        .map((group) => ({
          vendorId: group.vendorId,
          vendorName: this.resolveVendorName(group.vendorId, vendorNameById),
          totalAmount: group._sum.amount?.toNumber() ?? 0,
          expenseCount: group._count._all,
        }))
        .sort(
          (left, right) =>
            right.totalAmount - left.totalAmount ||
            left.vendorName.localeCompare(right.vendorName),
        )
        .map((total) => ({
          ...total,
          totalAmount: total.totalAmount.toFixed(2),
        })),
    };
  }

  async exportExpensesCsv(
    userId: string,
    query: GetReportDateRangeQueryDto = {},
  ): Promise<string> {
    const expenseDateRange = this.buildExpenseDateRange(query);
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        archivedAt: null,
        ...(expenseDateRange && { expenseDate: expenseDateRange }),
      },
      select: {
        description: true,
        amount: true,
        currency: true,
        expenseDate: true,
        notes: true,
        vendor: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
    });
    const rows = [
      [
        'Date',
        'Description',
        'Vendor',
        'Category',
        'Amount',
        'Currency',
        'Notes',
      ],
      ...expenses.map((expense) => [
        expense.expenseDate.toISOString().slice(0, 10),
        expense.description,
        expense.vendor.name,
        expense.category?.name ?? 'Uncategorized',
        expense.amount.toNumber().toFixed(2),
        expense.currency,
        expense.notes ?? '',
      ]),
    ];

    return `\uFEFF${rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(','))
      .join('\r\n')}`;
  }

  private buildExpenseDateRange(
    query: ReportDateQuery,
  ): ExpenseDateRange | undefined {
    const { dateFrom, dateTo } = query;

    if (!dateFrom && !dateTo) {
      return undefined;
    }

    const expenseDate: ExpenseDateRange = {};

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

    return expenseDate;
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

  private escapeCsvValue(value: string): string {
    const spreadsheetSafeValue = /^[=+\-@\t\r\n]/.test(value)
      ? `'${value}`
      : value;

    return `"${spreadsheetSafeValue.replaceAll('"', '""')}"`;
  }

  private resolveVendorName(
    vendorId: string,
    vendorNameById: Map<string, string>,
  ): string {
    const vendorName = vendorNameById.get(vendorId);
    if (!vendorName) {
      throw new Error(`Missing vendor for report group: ${vendorId}`);
    }

    return vendorName;
  }
}
