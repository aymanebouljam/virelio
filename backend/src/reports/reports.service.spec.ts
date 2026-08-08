import { ReportsService } from './reports.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  const userId = 'user-1';

  const expenseAggregateMock = jest.fn();
  const expenseGroupByMock = jest.fn();
  const expenseFindManyMock = jest.fn();
  const categoryFindManyMock = jest.fn();
  const vendorFindManyMock = jest.fn();
  const queryRawMock = jest.fn();

  const prisma = {
    expense: {
      aggregate: expenseAggregateMock,
      groupBy: expenseGroupByMock,
      findMany: expenseFindManyMock,
    },
    expenseCategory: {
      findMany: categoryFindManyMock,
    },
    vendor: {
      findMany: vendorFindManyMock,
    },
    $queryRaw: queryRawMock,
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    expenseAggregateMock.mockResolvedValue({
      _sum: { amount: null },
      _count: { _all: 0 },
    });
    expenseGroupByMock.mockResolvedValue([]);
    expenseFindManyMock.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([]);
    service = new ReportsService(prisma);
  });

  it('returns full aggregates with paginated expense rows', async () => {
    expenseAggregateMock.mockResolvedValueOnce({
      _sum: { amount: { toNumber: () => 300.5 } },
      _count: { _all: 2 },
    });
    expenseGroupByMock.mockResolvedValueOnce([
      {
        categoryId: 'category-1',
        _sum: { amount: { toNumber: () => 220 } },
        _count: { _all: 1 },
      },
      {
        categoryId: null,
        _sum: { amount: { toNumber: () => 80.5 } },
        _count: { _all: 1 },
      },
    ]);
    categoryFindManyMock.mockResolvedValueOnce([
      { id: 'category-1', name: 'Travel' },
    ]);
    expenseFindManyMock.mockResolvedValueOnce([
      {
        id: 'expense-1',
        description: 'Taxi',
        amount: { toNumber: () => 220 },
        expenseDate: new Date('2026-06-21T00:00:00.000Z'),
        notes: 'Client pickup',
        vendor: { id: 'vendor-1', name: 'City Transport' },
        category: { id: 'category-1', name: 'Travel' },
      },
    ]);

    await expect(service.getExpenseReport(userId)).resolves.toEqual({
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
      expenses: {
        items: [
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
        ],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 2,
          totalPages: 1,
        },
      },
    });

    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: { archivedAt: null, userId },
      include: {
        vendor: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(categoryFindManyMock).toHaveBeenCalledWith({
      where: { userId, id: { in: ['category-1'] } },
      select: { id: true, name: true },
    });
  });

  it('filters and paginates expense rows while retaining full aggregates', async () => {
    await service.getExpenseReport(userId, {
      dateFrom: '2026-06-20',
      dateTo: '2026-06-21',
      page: 2,
      pageSize: 5,
    });

    const where = {
      archivedAt: null,
      userId,
      expenseDate: {
        gte: new Date('2026-06-20'),
        lte: new Date('2026-06-21T23:59:59.999Z'),
      },
    };
    expect(expenseAggregateMock).toHaveBeenCalledWith({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    expect(expenseGroupByMock).toHaveBeenCalledWith({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
      _count: { _all: true },
    });
    expect(expenseFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
        skip: 5,
        take: 5,
      }),
    );
  });

  it('rejects invalid date range before querying expenses', async () => {
    await expect(
      service.getExpenseReport(userId, {
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

    expect(expenseAggregateMock).not.toHaveBeenCalled();
    expect(expenseGroupByMock).not.toHaveBeenCalled();
    expect(expenseFindManyMock).not.toHaveBeenCalled();
  });

  it('returns monthly and vendor totals for the selected date range', async () => {
    queryRawMock.mockResolvedValueOnce([
      {
        month: '2026-05',
        totalAmount: { toNumber: () => 80.5 },
        expenseCount: 1,
      },
      {
        month: '2026-06',
        totalAmount: { toNumber: () => 300.5 },
        expenseCount: 2,
      },
    ]);
    expenseGroupByMock.mockResolvedValueOnce([
      {
        vendorId: 'vendor-1',
        _sum: { amount: { toNumber: () => 220 } },
        _count: { _all: 1 },
      },
      {
        vendorId: 'vendor-2',
        _sum: { amount: { toNumber: () => 161 } },
        _count: { _all: 2 },
      },
    ]);
    vendorFindManyMock.mockResolvedValueOnce([
      { id: 'vendor-1', name: 'City Transport' },
      { id: 'vendor-2', name: 'Atlas Office' },
    ]);

    await expect(
      service.getReportInsights(userId, {
        dateFrom: '2026-05-01',
        dateTo: '2026-06-30',
      }),
    ).resolves.toEqual({
      monthlyTotals: [
        { month: '2026-05', totalAmount: '80.50', expenseCount: 1 },
        { month: '2026-06', totalAmount: '300.50', expenseCount: 2 },
      ],
      vendorTotals: [
        {
          vendorId: 'vendor-1',
          vendorName: 'City Transport',
          totalAmount: '220.00',
          expenseCount: 1,
        },
        {
          vendorId: 'vendor-2',
          vendorName: 'Atlas Office',
          totalAmount: '161.00',
          expenseCount: 2,
        },
      ],
    });

    expect(expenseGroupByMock).toHaveBeenCalledWith({
      by: ['vendorId'],
      where: {
        userId,
        archivedAt: null,
        expenseDate: {
          gte: new Date('2026-05-01'),
          lte: new Date('2026-06-30T23:59:59.999Z'),
        },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });
    expect(vendorFindManyMock).toHaveBeenCalledWith({
      where: { userId, id: { in: ['vendor-1', 'vendor-2'] } },
      select: { id: true, name: true },
    });
  });

  it('exports filtered expenses as spreadsheet-safe CSV', async () => {
    expenseFindManyMock.mockResolvedValueOnce([
      {
        description: '=SUM(A1:A2)',
        amount: { toNumber: () => 80.5 },
        currency: 'USD',
        expenseDate: new Date('2026-06-21T00:00:00.000Z'),
        notes: 'Line one,\n"quoted"',
        vendor: { name: '+Atlas Office' },
        category: null,
      },
    ]);

    await expect(
      service.exportExpensesCsv(userId, {
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
      }),
    ).resolves.toBe(
      '\uFEFF"Date","Description","Vendor","Category","Amount","Currency","Notes"\r\n' +
        '"2026-06-21","\'=SUM(A1:A2)","\'+Atlas Office","Uncategorized","80.50","USD","Line one,\n""quoted"""',
    );
    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: null,
        expenseDate: {
          gte: new Date('2026-06-01'),
          lte: new Date('2026-06-30T23:59:59.999Z'),
        },
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
  });
});
