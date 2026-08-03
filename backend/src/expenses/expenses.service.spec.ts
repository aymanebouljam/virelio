import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  const userId = 'user-1';

  const expenseFindManyMock = jest.fn();
  const expenseFindUniqueOrThrowMock = jest.fn();
  const expenseCreateMock = jest.fn();
  const expenseUpdateMock = jest.fn();
  const expenseDeleteMock = jest.fn();

  const vendorFindUniqueMock = jest.fn();
  const expenseCategoryFindUniqueMock = jest.fn();

  const prisma = {
    expense: {
      findMany: expenseFindManyMock,
      findUniqueOrThrow: expenseFindUniqueOrThrowMock,
      create: expenseCreateMock,
      update: expenseUpdateMock,
      delete: expenseDeleteMock,
    },
    vendor: {
      findUnique: vendorFindUniqueMock,
    },
    expenseCategory: {
      findUnique: expenseCategoryFindUniqueMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpensesService(prisma);
  });

  it('findAll returns active expenses ordered by expenseDate desc', async () => {
    const expenses = [
      { id: '1', description: 'Office supplies', archivedAt: null },
    ];
    expenseFindManyMock.mockResolvedValueOnce(expenses);

    const result = await service.findAll(userId);

    expect(result).toEqual(expenses);
    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: { userId, archivedAt: null },
      orderBy: { expenseDate: 'desc' },
    });
  });

  it('findAll applies search, relation, and inclusive date filters', async () => {
    expenseFindManyMock.mockResolvedValueOnce([]);

    await service.findAll(userId, {
      search: '  office  ',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: null,
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        expenseDate: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lte: new Date('2026-01-31T23:59:59.999Z'),
        },
        OR: [
          { description: { contains: 'office', mode: 'insensitive' } },
          { notes: { contains: 'office', mode: 'insensitive' } },
          {
            vendor: { name: { contains: 'office', mode: 'insensitive' } },
          },
          {
            category: { name: { contains: 'office', mode: 'insensitive' } },
          },
        ],
      },
      orderBy: { expenseDate: 'desc' },
    });
  });

  it('findAll rejects an inverted date range', () => {
    expect(() =>
      service.findAll(userId, {
        dateFrom: '2026-02-01',
        dateTo: '2026-01-31',
      }),
    ).toThrow(BadRequestException);

    expect(expenseFindManyMock).not.toHaveBeenCalled();
  });

  it('findArchived returns archived expenses ordered by archivedAt desc', async () => {
    const expenses = [
      { id: '1', description: 'Office supplies', archivedAt: new Date() },
    ];
    expenseFindManyMock.mockResolvedValueOnce(expenses);

    const result = await service.findArchived(userId);

    expect(result).toEqual(expenses);
    expect(expenseFindManyMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: {
          not: null,
        },
      },
      orderBy: { archivedAt: 'desc' },
    });
  });

  it('findOne returns active expense by id', async () => {
    const expense = {
      id: '1',
      description: 'Office supplies',
      archivedAt: null,
    };
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(expense);

    await expect(service.findOne(userId, '1')).resolves.toEqual(expense);
    expect(expenseFindUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id: '1',
        userId,
        archivedAt: null,
      },
    });
  });

  it('findOne throws not found when expense does not exist', async () => {
    expenseFindUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.findOne(userId, '1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOneDetailed returns active expense with vendor and category and proofs', async () => {
    const expense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
      vendor: {
        id: 'vendor-1',
        name: 'Atlas Office Supplies',
      },
      category: {
        id: 'category-1',
        name: 'Office',
        color: '#64748b',
      },
      proofs: [
        {
          id: 'proof-1',
          expenseId: 'expense-1',
          originalName: 'invoice.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 245760,
          storagePath: 'uploads/proofs/expense-1/invoice.pdf',
          createdAt: new Date('2026-06-18T10:00:00.000Z'),
        },
      ],
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(expense);

    await expect(service.findOneDetailed(userId, 'expense-1')).resolves.toEqual(
      expense,
    );
    expect(expenseFindUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id: 'expense-1',
        userId,
        archivedAt: null,
      },
      include: {
        vendor: true,
        category: true,
        proofs: true,
      },
    });
  });

  it('findOneDetailed throws not found when expense does not exist', async () => {
    expenseFindUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.findOneDetailed(userId, 'expense-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOneIncludingArchived returns expense by id', async () => {
    const expense = {
      id: '1',
      description: 'Office supplies',
      archivedAt: new Date(),
    };
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(expense);

    await expect(
      service.findOneIncludingArchived(userId, '1'),
    ).resolves.toEqual(expense);
    expect(expenseFindUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
  });

  it('findOneIncludingArchived throws not found when expense does not exist', async () => {
    expenseFindUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.findOneIncludingArchived(userId, '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create returns new stored expense', async () => {
    const input = {
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: '2026-01-15T00:00:00.000Z',
      notes: 'Monthly stationery',
    };

    const vendor = { id: 'vendor-1', userId, archivedAt: null };
    const category = { id: 'category-1', userId, archivedAt: null };
    const createdExpense = {
      id: 'expense-1',
      ...input,
      expenseDate: new Date(input.expenseDate),
      archivedAt: null,
    };

    vendorFindUniqueMock.mockResolvedValueOnce(vendor);
    expenseCategoryFindUniqueMock.mockResolvedValueOnce(category);
    expenseCreateMock.mockResolvedValueOnce(createdExpense);

    const result = await service.create(userId, input);

    expect(result).toEqual(createdExpense);
    expect(expenseCreateMock).toHaveBeenCalledWith({
      data: {
        userId,
        vendorId: input.vendorId,
        categoryId: input.categoryId,
        description: input.description,
        amount: input.amount,
        expenseDate: new Date(input.expenseDate),
        notes: input.notes,
      },
    });
  });

  it('create throws not found when vendor does not exist', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('create throws not found when category does not exist', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('update returns updated expense', async () => {
    const existingExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
    };

    const input = {
      description: 'Office supplies and toner',
      amount: 1400.75,
      expenseDate: '2026-01-16T00:00:00.000Z',
    };

    const updatedExpense = {
      ...existingExpense,
      ...input,
      expenseDate: new Date(input.expenseDate),
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(existingExpense);
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce({
      id: 'category-1',
      userId,
      archivedAt: null,
    });
    expenseUpdateMock.mockResolvedValueOnce(updatedExpense);

    await expect(service.update(userId, 'expense-1', input)).resolves.toEqual(
      updatedExpense,
    );
    expect(expenseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId },
      data: {
        ...input,
        expenseDate: new Date(input.expenseDate),
      },
    });
  });

  it('update rejects empty body', async () => {
    await expect(
      service.update(userId, 'expense-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update throws not found when expense does not exist', async () => {
    expenseFindUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.update(userId, 'expense-1', {
        description: 'Updated description',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('archive returns archived expense', async () => {
    const activeExpense = {
      id: 'expense-1',
      description: 'Office supplies',
      archivedAt: null,
    };

    const archivedExpense = {
      ...activeExpense,
      archivedAt: new Date(),
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(activeExpense);
    expenseUpdateMock.mockResolvedValueOnce(archivedExpense);

    const result = await service.archive(userId, 'expense-1');

    expect(result).toEqual(archivedExpense);
    expect(expenseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId },
      data: {
        archivedAt: expect.any(Date) as unknown,
      },
    });
  });

  it('archive rejects already archived expense', async () => {
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'expense-1',
      archivedAt: new Date(),
    });

    await expect(service.archive(userId, 'expense-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('restore returns restored expense', async () => {
    const archivedExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      archivedAt: new Date(),
    };

    const restoredExpense = {
      ...archivedExpense,
      archivedAt: null,
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(archivedExpense);
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce({
      id: 'category-1',
      userId,
      archivedAt: null,
    });
    expenseUpdateMock.mockResolvedValueOnce(restoredExpense);

    const result = await service.restore(userId, 'expense-1');

    expect(result).toEqual(restoredExpense);
    expect(expenseUpdateMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId },
      data: {
        archivedAt: null,
      },
    });
  });

  it('restore rejects non archived expense', async () => {
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'expense-1',
      archivedAt: null,
    });

    await expect(service.restore(userId, 'expense-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('remove returns removed archived expense record on success', async () => {
    const archivedExpense = {
      id: 'expense-1',
      description: 'Office supplies',
      archivedAt: new Date(),
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(archivedExpense);
    expenseDeleteMock.mockResolvedValueOnce(archivedExpense);

    const result = await service.remove(userId, 'expense-1');

    expect(result).toEqual(archivedExpense);
    expect(expenseDeleteMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId },
    });
  });

  it('remove rejects non archived expense', async () => {
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'expense-1',
      archivedAt: null,
    });

    await expect(service.remove(userId, 'expense-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(expenseDeleteMock).not.toHaveBeenCalled();
  });
  it('create throws vendor not found when vendor does not exist', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Vendor not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).not.toHaveBeenCalled();
    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('create throws vendor not found when vendor is archived', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: new Date(),
    });

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Vendor not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).not.toHaveBeenCalled();
    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('create throws expense category not found when category does not exist', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Expense category not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'category-1' },
    });
    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('create throws expense category not found when category is archived', async () => {
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce({
      id: 'category-1',
      userId,
      archivedAt: new Date(),
    });

    await expect(
      service.create(userId, {
        vendorId: 'vendor-1',
        categoryId: 'category-1',
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      }),
    ).rejects.toMatchObject({
      response: {
        message: 'Expense category not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'category-1' },
    });
    expect(expenseCreateMock).not.toHaveBeenCalled();
  });

  it('update throws vendor not found when updated vendor does not exist', async () => {
    const existingExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(existingExpense);
    vendorFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.update(userId, 'expense-1', { vendorId: 'vendor-2' }),
    ).rejects.toMatchObject({
      response: {
        message: 'Vendor not found',
      },
    });

    expect(expenseFindUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId },
    });
    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-2' },
    });
    expect(expenseCategoryFindUniqueMock).not.toHaveBeenCalled();
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('update throws vendor not found when updated vendor is archived', async () => {
    const existingExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(existingExpense);
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-2',
      userId,
      archivedAt: new Date(),
    });

    await expect(
      service.update(userId, 'expense-1', { vendorId: 'vendor-2' }),
    ).rejects.toMatchObject({
      response: {
        message: 'Vendor not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-2' },
    });
    expect(expenseCategoryFindUniqueMock).not.toHaveBeenCalled();
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('update throws expense category not found when updated category does not exist', async () => {
    const existingExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(existingExpense);
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.update(userId, 'expense-1', { categoryId: 'category-2' }),
    ).rejects.toMatchObject({
      response: {
        message: 'Expense category not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'category-2' },
    });
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('update throws expense category not found when updated category is archived', async () => {
    const existingExpense = {
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      description: 'Office supplies',
      amount: 1250.5,
      expenseDate: new Date('2026-01-15T00:00:00.000Z'),
      archivedAt: null,
    };

    expenseFindUniqueOrThrowMock.mockResolvedValueOnce(existingExpense);
    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce({
      id: 'category-2',
      userId,
      archivedAt: new Date(),
    });

    await expect(
      service.update(userId, 'expense-1', { categoryId: 'category-2' }),
    ).rejects.toMatchObject({
      response: {
        message: 'Expense category not found',
      },
    });

    expect(expenseCategoryFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'category-2' },
    });
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('restore throws vendor not found when vendor is archived', async () => {
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      archivedAt: new Date(),
    });

    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: new Date(),
    });

    await expect(service.restore(userId, 'expense-1')).rejects.toMatchObject({
      response: {
        message: 'Vendor not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).not.toHaveBeenCalled();
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });

  it('restore throws expense category not found when category is archived', async () => {
    expenseFindUniqueOrThrowMock.mockResolvedValueOnce({
      id: 'expense-1',
      vendorId: 'vendor-1',
      categoryId: 'category-1',
      archivedAt: new Date(),
    });

    vendorFindUniqueMock.mockResolvedValueOnce({
      id: 'vendor-1',
      userId,
      archivedAt: null,
    });
    expenseCategoryFindUniqueMock.mockResolvedValueOnce({
      id: 'category-1',
      userId,
      archivedAt: new Date(),
    });

    await expect(service.restore(userId, 'expense-1')).rejects.toMatchObject({
      response: {
        message: 'Expense category not found',
      },
    });

    expect(vendorFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'vendor-1' },
    });
    expect(expenseCategoryFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'category-1' },
    });
    expect(expenseUpdateMock).not.toHaveBeenCalled();
  });
});
