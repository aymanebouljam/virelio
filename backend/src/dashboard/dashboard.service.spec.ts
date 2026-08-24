import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  const userId = 'user-1';

  const vendorCountMock = jest.fn();
  const expenseCountMock = jest.fn();
  const proofCountMock = jest.fn();
  const recurringExpenseTemplateCountMock = jest.fn();
  const expenseFindManyMock = jest.fn();
  const proofFindManyMock = jest.fn();

  const prisma = {
    vendor: {
      count: vendorCountMock,
    },
    expense: {
      count: expenseCountMock,
      findMany: expenseFindManyMock,
    },
    proofDocument: {
      count: proofCountMock,
      findMany: proofFindManyMock,
    },
    recurringExpenseTemplate: {
      count: recurringExpenseTemplateCountMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    vendorCountMock.mockResolvedValue(0);
    expenseCountMock.mockResolvedValue(0);
    proofCountMock.mockResolvedValue(0);
    recurringExpenseTemplateCountMock.mockResolvedValue(0);
    expenseFindManyMock.mockResolvedValue([]);
    proofFindManyMock.mockResolvedValue([]);
    service = new DashboardService(prisma);
  });

  function expense(categoryNumber: number, amount: number) {
    return {
      id: `expense-${categoryNumber}`,
      description: `Expense ${categoryNumber}`,
      amount: {
        toNumber: () => amount,
      },
      expenseDate: new Date(
        `2026-06-${categoryNumber.toString().padStart(2, '0')}T00:00:00.000Z`,
      ),
      vendor: {
        id: 'vendor-1',
        name: 'Vendor',
      },
      category: {
        id: `category-${categoryNumber}`,
        name: `Category ${categoryNumber}`,
      },
    };
  }

  function proof(number: number) {
    return {
      id: `proof-${number}`,
      originalName: `receipt-${number}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      storagePath: `uploads/proofs/expense-${number}/receipt-${number}.jpg`,
      createdAt: new Date(
        `2026-06-${(number + 5).toString().padStart(2, '0')}T00:00:00.000Z`,
      ),
      expense: {
        id: `expense-${number}`,
        description: `Expense ${number}`,
      },
    };
  }

  it('returns dashboard summary aggregates', async () => {
    vendorCountMock.mockResolvedValueOnce(4);
    expenseCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    proofCountMock.mockResolvedValueOnce(3);
    recurringExpenseTemplateCountMock.mockResolvedValueOnce(2);
    expenseFindManyMock.mockResolvedValueOnce([
      {
        id: 'expense-1',
        description: 'Taxi',
        amount: {
          toNumber: () => 220,
        },
        expenseDate: new Date('2026-06-21T00:00:00.000Z'),
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
        vendor: {
          id: 'vendor-2',
          name: 'Atlas Office Supplies',
        },
        category: null,
      },
    ]);
    proofFindManyMock.mockResolvedValueOnce([
      {
        id: 'proof-1',
        originalName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 245760,
        storagePath: 'uploads/proofs/expense-1/receipt.jpg',
        createdAt: new Date('2026-06-22T10:00:00.000Z'),
        expense: {
          id: 'expense-1',
          description: 'Airport transfer',
        },
      },
    ]);

    await expect(service.getSummary(userId)).resolves.toEqual({
      totalSpend: '300.50',
      activeVendors: 4,
      uncategorizedExpenses: 2,
      proofDocuments: 3,
      missingProofExpenses: 1,
      dueRecurringExpenses: 2,
      recentExpenses: [
        {
          id: 'expense-1',
          description: 'Taxi',
          amount: '220.00',
          expenseDate: '2026-06-21T00:00:00.000Z',
          vendorId: 'vendor-1',
          vendorName: 'City Transport',
          categoryName: 'Travel',
        },
        {
          id: 'expense-2',
          description: 'Paper',
          amount: '80.50',
          expenseDate: '2026-06-20T00:00:00.000Z',
          vendorId: 'vendor-2',
          vendorName: 'Atlas Office Supplies',
          categoryName: 'Uncategorized',
        },
      ],
      recentProofs: [
        {
          id: 'proof-1',
          originalName: 'receipt.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 245760,
          createdAt: new Date('2026-06-22T10:00:00.000Z').toISOString(),
          expenseId: 'expense-1',
          expenseDescription: 'Airport transfer',
        },
      ],
      recentActivity: [
        {
          id: 'proof-1',
          type: 'proof',
          title: 'receipt.jpg',
          subtitle: 'Airport transfer',
          occurredAt: new Date('2026-06-22T10:00:00.000Z').toISOString(),
          expenseId: 'expense-1',
        },
        {
          id: 'expense-1',
          type: 'expense',
          title: 'Taxi',
          subtitle: 'City Transport · Travel',
          occurredAt: new Date('2026-06-21T00:00:00.000Z').toISOString(),
          expenseId: 'expense-1',
        },
        {
          id: 'expense-2',
          type: 'expense',
          title: 'Paper',
          subtitle: 'Atlas Office Supplies · Uncategorized',
          occurredAt: new Date('2026-06-20T00:00:00.000Z').toISOString(),
          expenseId: 'expense-2',
        },
      ],

      categoryBreakdown: [
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
    });

    expect(vendorCountMock).toHaveBeenCalledWith({
      where: { userId, archivedAt: null },
    });
    expect(expenseCountMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: null,
        categoryId: null,
      },
    });
    expect(proofCountMock).toHaveBeenCalledWith({
      where: {
        expense: {
          userId,
          archivedAt: null,
        },
      },
    });
    expect(expenseCountMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: null,
        proofs: { none: {} },
      },
    });
    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: { userId, archivedAt: null },
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
    expect(proofFindManyMock).toHaveBeenCalledWith({
      where: {
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
    });
  });

  it('returns empty summary when no expenses exist', async () => {
    vendorCountMock.mockResolvedValueOnce(0);
    expenseCountMock.mockResolvedValueOnce(0);
    proofCountMock.mockResolvedValueOnce(0);
    expenseFindManyMock.mockResolvedValueOnce([]);
    proofFindManyMock.mockResolvedValueOnce([]);

    await expect(service.getSummary(userId)).resolves.toEqual({
      totalSpend: '0.00',
      activeVendors: 0,
      uncategorizedExpenses: 0,
      proofDocuments: 0,
      missingProofExpenses: 0,
      dueRecurringExpenses: 0,
      recentExpenses: [],
      recentProofs: [],
      recentActivity: [],
      categoryBreakdown: [],
    });
  });

  it('returns the six most recent activity entries', async () => {
    vendorCountMock.mockResolvedValueOnce(1);
    expenseCountMock.mockResolvedValueOnce(0);
    proofCountMock.mockResolvedValueOnce(5);
    expenseFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, index) => expense(index + 1, 100)),
    );
    proofFindManyMock.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, index) => proof(index + 1)),
    );

    const summary = await service.getSummary(userId);

    expect(summary.recentActivity).toHaveLength(6);
    expect(summary.recentActivity.map((activity) => activity.id)).toEqual([
      'proof-5',
      'proof-4',
      'proof-3',
      'proof-2',
      'proof-1',
      'expense-5',
    ]);
  });

  it('groups category totals outside the five highest-spend categories as Other', async () => {
    vendorCountMock.mockResolvedValueOnce(1);
    expenseCountMock.mockResolvedValueOnce(0);
    proofCountMock.mockResolvedValueOnce(0);
    expenseFindManyMock.mockResolvedValueOnce([
      expense(1, 700),
      expense(2, 600),
      expense(3, 500),
      expense(4, 400),
      expense(5, 300),
      expense(6, 200),
      expense(7, 100),
    ]);
    proofFindManyMock.mockResolvedValueOnce([]);

    const summary = await service.getSummary(userId);

    expect(summary.categoryBreakdown).toEqual([
      {
        categoryId: 'category-1',
        categoryName: 'Category 1',
        totalAmount: '700.00',
        expenseCount: 1,
      },
      {
        categoryId: 'category-2',
        categoryName: 'Category 2',
        totalAmount: '600.00',
        expenseCount: 1,
      },
      {
        categoryId: 'category-3',
        categoryName: 'Category 3',
        totalAmount: '500.00',
        expenseCount: 1,
      },
      {
        categoryId: 'category-4',
        categoryName: 'Category 4',
        totalAmount: '400.00',
        expenseCount: 1,
      },
      {
        categoryId: 'category-5',
        categoryName: 'Category 5',
        totalAmount: '300.00',
        expenseCount: 1,
      },
      {
        categoryId: null,
        categoryName: 'Other',
        totalAmount: '300.00',
        expenseCount: 2,
      },
    ]);
  });

  it('filters dashboard summary by expense date range', async () => {
    vendorCountMock.mockResolvedValueOnce(4);
    expenseCountMock.mockResolvedValueOnce(1);
    proofCountMock.mockResolvedValueOnce(1);
    expenseFindManyMock.mockResolvedValueOnce([
      {
        id: 'expense-1',
        description: 'Taxi',
        amount: {
          toNumber: () => 220,
        },
        expenseDate: new Date('2026-06-21T00:00:00.000Z'),
        vendor: {
          id: 'vendor-1',
          name: 'City Transport',
        },
        category: {
          id: 'category-1',
          name: 'Travel',
        },
      },
    ]);
    proofFindManyMock.mockResolvedValueOnce([
      {
        id: 'proof-1',
        originalName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 245760,
        storagePath: 'uploads/proofs/expense-1/receipt.jpg',
        createdAt: new Date('2026-06-22T10:00:00.000Z'),
        expense: {
          id: 'expense-1',
          description: 'Taxi',
        },
      },
    ]);

    await expect(
      service.getSummary(userId, {
        dateFrom: '2026-06-20',
        dateTo: '2026-06-21',
      }),
    ).resolves.toMatchObject({
      totalSpend: '220.00',
      uncategorizedExpenses: 1,
      proofDocuments: 1,
    });

    expect(expenseCountMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: null,
        categoryId: null,
      },
    });

    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        userId,
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

  it('rejects dashboard summary when dateFrom is after dateTo', async () => {
    await expect(
      service.getSummary(userId, {
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

    expect(expenseCountMock).not.toHaveBeenCalled();
    expect(expenseFindManyMock).not.toHaveBeenCalled();
    expect(proofCountMock).not.toHaveBeenCalled();
    expect(proofFindManyMock).not.toHaveBeenCalled();
  });
});
