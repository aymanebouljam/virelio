import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const expenseFindManyMock = jest.fn();

  const prisma = {
    expense: {
      findMany: expenseFindManyMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ReportsService(prisma);
  });

  it('returns expense report aggregates', async () => {
    expenseFindManyMock.mockResolvedValueOnce([
      {
        id: 'expense-1',
        description: 'Taxi',
        amount: {
          toNumber: () => 220,
        },
        expenseDate: new Date('2026-06-21T00:00:00.000Z'),
        notes: 'Client pickup',
        vendor: {
          id: 'vendor-1',
          name: 'City Transport',
        },
        category: {
          id: 'category-1',
          name: 'Travel',
        },
      },
      {
        id: 'expense-2',
        description: 'Paper',
        amount: {
          toNumber: () => 80.5,
        },
        expenseDate: new Date('2026-06-20T00:00:00.000Z'),
        notes: null,
        vendor: {
          id: 'vendor-2',
          name: 'Atlas Office Supplies',
        },
        category: null,
      },
    ]);

    await expect(service.getExpenseReport()).resolves.toEqual({
      totalAmount: '300.50',
      expenseCount: 2,
      categoryTotals: [
        {
          categoryId: 'category-1',
          categoryName: 'Travel',
          totalAmount: '220.00',
          expenseCount: 1,
        },
        {
          categoryId: null,
          categoryName: 'Uncategorized',
          totalAmount: '80.50',
          expenseCount: 1,
        },
      ],
      expenses: [
        {
          id: 'expense-1',
          description: 'Taxi',
          amount: '220.00',
          expenseDate: '2026-06-21T00:00:00.000Z',
          vendorId: 'vendor-1',
          vendorName: 'City Transport',
          categoryId: 'category-1',
          categoryName: 'Travel',
          notes: 'Client pickup',
        },
        {
          id: 'expense-2',
          description: 'Paper',
          amount: '80.50',
          expenseDate: '2026-06-20T00:00:00.000Z',
          vendorId: 'vendor-2',
          vendorName: 'Atlas Office Supplies',
          categoryId: null,
          categoryName: 'Uncategorized',
          notes: null,
        },
      ],
    });

    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
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
  });

  it('filters expense report by date range', async () => {
    expenseFindManyMock.mockResolvedValueOnce([]);

    await service.getExpenseReport({
      dateFrom: '2026-06-20',
      dateTo: '2026-06-21',
    });

    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        expenseDate: {
          gte: new Date('2026-06-20'),
          lte: new Date('2026-06-21T23:59:59.999Z'),
        },
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
  });

  it('rejects invalid date range', async () => {
    await expect(
      service.getExpenseReport({
        dateFrom: '2026-06-22',
        dateTo: '2026-06-21',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [
          {
            field: 'dateRange',
            constraints: {
              isValid: 'Date From must be before or equal to date To',
            },
          },
        ],
      },
    });

    expect(expenseFindManyMock).not.toHaveBeenCalled();
  });
});
