import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecurrenceFrequency } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecurringExpenseTemplatesService } from './recurring-expense-templates.service';

describe('RecurringExpenseTemplatesService', () => {
  const userId = 'user-1';
  const templateId = 'template-1';
  const vendorId = 'vendor-1';
  const categoryId = 'category-1';
  const amount = new Prisma.Decimal('120.00');

  const findManyMock = jest.fn();
  const countMock = jest.fn();
  const findUniqueOrThrowMock = jest.fn();
  const createTemplateMock = jest.fn();
  const updateTemplateMock = jest.fn();
  const updateManyTemplatesMock = jest.fn();
  const deleteTemplateMock = jest.fn();
  const createExpenseMock = jest.fn();
  const findVendorMock = jest.fn();
  const findCategoryMock = jest.fn();
  const transactionMock = jest.fn();

  const transaction = {
    recurringExpenseTemplate: { updateMany: updateManyTemplatesMock },
    expense: { create: createExpenseMock },
  };
  const prisma = {
    recurringExpenseTemplate: {
      findMany: findManyMock,
      count: countMock,
      findUniqueOrThrow: findUniqueOrThrowMock,
      create: createTemplateMock,
      update: updateTemplateMock,
      delete: deleteTemplateMock,
    },
    vendor: { findUnique: findVendorMock },
    expenseCategory: { findUnique: findCategoryMock },
    $transaction: transactionMock,
  } as unknown as PrismaService;

  let service: RecurringExpenseTemplatesService;

  function template(
    overrides: Partial<{
      archivedAt: Date | null;
      categoryId: string | null;
      frequency: RecurrenceFrequency;
      nextDueDate: Date;
    }> = {},
  ) {
    return {
      id: templateId,
      userId,
      vendorId,
      categoryId,
      description: 'Workspace subscription',
      amount,
      currency: 'USD',
      frequency: RecurrenceFrequency.MONTHLY,
      nextDueDate: new Date('2024-01-31T00:00:00.000Z'),
      notes: 'Team plan',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      archivedAt: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RecurringExpenseTemplatesService(prisma);
    findVendorMock.mockResolvedValue({
      id: vendorId,
      userId,
      archivedAt: null,
    });
    findCategoryMock.mockResolvedValue({
      id: categoryId,
      userId,
      archivedAt: null,
    });
    transactionMock.mockImplementation(
      (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns active templates with six-item pagination by default', async () => {
    const templates = [template()];
    findManyMock.mockResolvedValue(templates);
    countMock.mockResolvedValue(7);

    await expect(service.findPage(userId)).resolves.toEqual({
      items: templates,
      pagination: {
        page: 1,
        pageSize: 6,
        totalItems: 7,
        totalPages: 2,
      },
    });
    const where = { userId, archivedAt: null };
    expect(findManyMock).toHaveBeenCalledWith({
      where,
      include: { vendor: true, category: true },
      orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }],
      skip: 0,
      take: 6,
    });
    expect(countMock).toHaveBeenCalledWith({ where });
  });

  it('uses requested pagination values', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(13);

    await expect(
      service.findPage(userId, { page: 2, pageSize: 6 }),
    ).resolves.toMatchObject({
      pagination: { page: 2, pageSize: 6, totalItems: 13, totalPages: 3 },
    });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 6, take: 6 }),
    );
  });

  it('filters templates due in the next seven days', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T12:00:00.000Z'));
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.findPage(userId, { due: 'next-7-days' });

    const where = {
      userId,
      archivedAt: null,
      nextDueDate: {
        gte: new Date('2026-09-03T00:00:00.000Z'),
        lte: new Date('2026-09-10T00:00:00.000Z'),
      },
    };
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(countMock).toHaveBeenCalledWith({ where });
  });

  it('returns archived templates ordered by archive time', async () => {
    const archivedTemplates = [template({ archivedAt: new Date() })];
    findManyMock.mockResolvedValue(archivedTemplates);

    await expect(service.findArchived(userId)).resolves.toEqual(
      archivedTemplates,
    );
    expect(findManyMock).toHaveBeenCalledWith({
      where: { userId, archivedAt: { not: null } },
      include: { vendor: true, category: true },
      orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
    });
  });

  it('creates a tenant-owned template with validated relations', async () => {
    const body = {
      vendorId,
      categoryId,
      description: 'Workspace subscription',
      amount: 120,
      frequency: RecurrenceFrequency.MONTHLY,
      nextDueDate: '2024-01-31',
      notes: 'Team plan',
    };
    createTemplateMock.mockResolvedValue(template());

    await expect(service.create(userId, body)).resolves.toEqual(template());
    expect(createTemplateMock).toHaveBeenCalledWith({
      data: {
        ...body,
        userId,
        nextDueDate: new Date('2024-01-31'),
      },
      include: { vendor: true, category: true },
    });
  });

  it('rejects relations that are not active and owned by the user', async () => {
    findVendorMock.mockResolvedValue({
      id: vendorId,
      userId: 'another-user',
      archivedAt: null,
    });

    await expect(
      service.create(userId, {
        vendorId,
        description: 'Workspace subscription',
        amount: 120,
        frequency: RecurrenceFrequency.MONTHLY,
        nextDueDate: '2024-01-31',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(createTemplateMock).not.toHaveBeenCalled();
  });

  it('rejects empty updates', async () => {
    await expect(service.update(userId, templateId, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates template fields and clears an optional category', async () => {
    findUniqueOrThrowMock.mockResolvedValue(template());
    updateTemplateMock.mockResolvedValue(template({ categoryId: null }));

    await service.update(userId, templateId, {
      categoryId: null,
      nextDueDate: '2024-02-29',
      notes: null,
    });

    expect(updateTemplateMock).toHaveBeenCalledWith({
      where: { id: templateId, userId },
      data: {
        categoryId: null,
        nextDueDate: new Date('2024-02-29'),
        notes: null,
      },
      include: { vendor: true, category: true },
    });
    expect(findCategoryMock).not.toHaveBeenCalled();
  });

  it('archives an active template', async () => {
    const archivedAt = new Date('2026-08-09T10:00:00.000Z');
    jest.useFakeTimers({ now: archivedAt });
    findUniqueOrThrowMock.mockResolvedValue(template());
    updateTemplateMock.mockResolvedValue(template({ archivedAt }));

    await service.archive(userId, templateId);

    expect(updateTemplateMock).toHaveBeenCalledWith({
      where: { id: templateId, userId },
      data: { archivedAt },
    });
  });

  it('rejects archiving an archived template', async () => {
    findUniqueOrThrowMock.mockResolvedValue(
      template({ archivedAt: new Date() }),
    );

    await expect(service.archive(userId, templateId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateTemplateMock).not.toHaveBeenCalled();
  });

  it('restores an archived template after validating its relations', async () => {
    findUniqueOrThrowMock.mockResolvedValue(
      template({ archivedAt: new Date() }),
    );
    updateTemplateMock.mockResolvedValue(template());

    await service.restore(userId, templateId);

    expect(findVendorMock).toHaveBeenCalledWith({ where: { id: vendorId } });
    expect(findCategoryMock).toHaveBeenCalledWith({
      where: { id: categoryId },
    });
    expect(updateTemplateMock).toHaveBeenCalledWith({
      where: { id: templateId, userId },
      data: { archivedAt: null },
    });
  });

  it('deletes only archived templates', async () => {
    const archivedTemplate = template({ archivedAt: new Date() });
    findUniqueOrThrowMock.mockResolvedValue(archivedTemplate);
    deleteTemplateMock.mockResolvedValue(archivedTemplate);

    await expect(service.remove(userId, templateId)).resolves.toEqual(
      archivedTemplate,
    );
    expect(deleteTemplateMock).toHaveBeenCalledWith({
      where: { id: templateId, userId },
    });
  });

  it('rejects deleting an active template', async () => {
    findUniqueOrThrowMock.mockResolvedValue(template());

    await expect(service.remove(userId, templateId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(deleteTemplateMock).not.toHaveBeenCalled();
  });

  it('rejects generation before the next due date', async () => {
    findUniqueOrThrowMock.mockResolvedValue(
      template({ nextDueDate: new Date('2999-01-01T00:00:00.000Z') }),
    );

    await expect(
      service.generateDueExpense(userId, templateId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      RecurrenceFrequency.WEEKLY,
      '2024-01-01T00:00:00.000Z',
      '2024-01-08T00:00:00.000Z',
    ],
    [
      RecurrenceFrequency.MONTHLY,
      '2024-01-31T00:00:00.000Z',
      '2024-02-29T00:00:00.000Z',
    ],
    [
      RecurrenceFrequency.YEARLY,
      '2024-02-29T00:00:00.000Z',
      '2025-02-28T00:00:00.000Z',
    ],
  ])(
    'generates a due %s expense and advances its schedule',
    async (frequency, dueDateValue, nextDueDateValue) => {
      const dueDate = new Date(dueDateValue);
      const recurringTemplate = template({ frequency, nextDueDate: dueDate });
      const expense = { id: 'expense-1' };
      findUniqueOrThrowMock.mockResolvedValue(recurringTemplate);
      updateManyTemplatesMock.mockResolvedValue({ count: 1 });
      createExpenseMock.mockResolvedValue(expense);

      await expect(
        service.generateDueExpense(userId, templateId),
      ).resolves.toEqual(expense);
      expect(updateManyTemplatesMock).toHaveBeenCalledWith({
        where: {
          id: templateId,
          userId,
          archivedAt: null,
          nextDueDate: dueDate,
        },
        data: { nextDueDate: new Date(nextDueDateValue) },
      });
      expect(createExpenseMock).toHaveBeenCalledWith({
        data: {
          userId,
          vendorId,
          categoryId,
          recurringExpenseTemplateId: templateId,
          description: recurringTemplate.description,
          amount,
          currency: 'USD',
          expenseDate: dueDate,
          notes: 'Team plan',
        },
      });
    },
  );

  it('rejects a concurrent generation after another request advances the template', async () => {
    findUniqueOrThrowMock.mockResolvedValue(template());
    updateManyTemplatesMock.mockResolvedValue({ count: 0 });

    await expect(
      service.generateDueExpense(userId, templateId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createExpenseMock).not.toHaveBeenCalled();
  });
});
