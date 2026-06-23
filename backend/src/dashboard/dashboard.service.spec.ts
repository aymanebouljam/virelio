import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;

  const vendorCountMock = jest.fn();
  const expenseCountMock = jest.fn();
  const proofCountMock = jest.fn();
  const expenseFindManyMock = jest.fn();

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
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new DashboardService(prisma);
  });

  it('returns dashboard summary aggregates', async () => {
    vendorCountMock.mockResolvedValueOnce(4);
    expenseCountMock.mockResolvedValueOnce(2);
    proofCountMock.mockResolvedValueOnce(3);
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

    await expect(service.getSummary()).resolves.toEqual({
      totalSpend: '300.50',
      activeVendors: 4,
      uncategorizedExpenses: 2,
      proofDocuments: 3,
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
          categoryName: null,
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
      where: { archivedAt: null },
    });
    expect(expenseCountMock).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        categoryId: null,
      },
    });
    expect(proofCountMock).toHaveBeenCalled();
    expect(expenseFindManyMock).toHaveBeenCalledWith({
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
    });
  });

  it('returns empty summary when no expenses exist', async () => {
    vendorCountMock.mockResolvedValueOnce(0);
    expenseCountMock.mockResolvedValueOnce(0);
    proofCountMock.mockResolvedValueOnce(0);
    expenseFindManyMock.mockResolvedValueOnce([]);

    await expect(service.getSummary()).resolves.toEqual({
      totalSpend: '0.00',
      activeVendors: 0,
      uncategorizedExpenses: 0,
      proofDocuments: 0,
      recentExpenses: [],
      categoryBreakdown: [],
    });
  });
});
