import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpenseCategoriesService } from './expense-categories.service';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;

  const findManyMock = jest.fn();
  const findUniqueOrThrowMock = jest.fn();
  const createMock = jest.fn();
  const updateMock = jest.fn();
  const removeMock = jest.fn();

  const prisma = {
    expenseCategory: {
      findMany: findManyMock,
      findUniqueOrThrow: findUniqueOrThrowMock,
      create: createMock,
      update: updateMock,
      delete: removeMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpenseCategoriesService(prisma);
  });

  // READ
  it('findAll returns active expense categories ordered by createdAt desc', async () => {
    const categories = [{ id: '1', name: 'Office', archivedAt: null }];
    findManyMock.mockResolvedValue(categories);

    const result = await service.findAll();

    expect(result).toEqual(categories);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findArchived returns archived expense categories ordered by archivedAt desc', async () => {
    const categories = [{ id: '1', name: 'Office', archivedAt: new Date() }];
    findManyMock.mockResolvedValue(categories);

    const result = await service.findArchived();

    expect(result).toEqual(categories);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        archivedAt: {
          not: null,
        },
      },
      orderBy: { archivedAt: 'desc' },
    });
  });

  it('findOne returns active expense category by id', async () => {
    const id = '1';
    const category = { id, name: 'Office', archivedAt: null };
    findUniqueOrThrowMock.mockResolvedValueOnce(category);

    await expect(service.findOne(id)).resolves.toEqual(category);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        archivedAt: null,
      },
    });
  });

  it('findOne throws not found when expense category does not exist', async () => {
    const id = 'missing-id';
    findUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        archivedAt: null,
      },
    });
  });

  it('findOneIncludingArchived returns expense category by id', async () => {
    const id = '1';
    const category = { id, name: 'Office', archivedAt: new Date() };
    findUniqueOrThrowMock.mockResolvedValueOnce(category);

    await expect(service.findOneIncludingArchived(id)).resolves.toEqual(
      category,
    );
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id },
    });
  });

  it('findOneIncludingArchived throws not found when expense category does not exist', async () => {
    const id = 'missing-id';
    findUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.findOneIncludingArchived(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id },
    });
  });

  // CREATE
  it('create returns new stored expense category', async () => {
    const input = { name: 'Office', color: '#64748b' };
    const category = { ...input, id: '1', archivedAt: null };
    createMock.mockResolvedValueOnce(category);

    const result = await service.create(input);

    expect(result).toEqual(category);
    expect(createMock).toHaveBeenCalledWith({
      data: input,
    });
  });

  it('create throws unique conflict when expense category name already exists', async () => {
    const input = { name: 'Office', color: '#64748b' };

    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(createMock).toHaveBeenCalledWith({
      data: input,
    });
  });

  // UPDATE
  it('update returns updated expense category', async () => {
    const input = { color: '#0f172a' };
    const updatedCategory = {
      id: '1',
      name: 'Office',
      color: '#0f172a',
      archivedAt: null,
    };

    updateMock.mockResolvedValueOnce(updatedCategory);

    await expect(service.update('1', input)).resolves.toEqual(updatedCategory);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: input,
    });
  });

  it('update rejects empty body', async () => {
    await expect(service.update('1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update throws not found when expense category does not exist', async () => {
    const input = { color: '#0f172a' };

    updateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.update('1', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: input,
    });
  });

  it('update throws unique conflict when expense category name already exists', async () => {
    const input = { name: 'Travel' };

    updateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.update('1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: input,
    });
  });

  // ARCHIVE
  it('archive returns archived expense category', async () => {
    const activeCategory = {
      id: '1',
      name: 'Office',
      archivedAt: null,
    };

    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(activeCategory);
    updateMock.mockResolvedValueOnce(archivedCategory);

    const result = await service.archive('1');

    expect(result).toEqual(archivedCategory);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: {
        archivedAt: expect.any(Date) as unknown,
      },
    });
  });

  it('archive rejects already archived expense category', async () => {
    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedCategory);

    await expect(service.archive('1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  // RESTORE
  it('restore returns restored expense category', async () => {
    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    const restoredCategory = {
      id: '1',
      name: 'Office',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedCategory);
    updateMock.mockResolvedValueOnce(restoredCategory);

    const result = await service.restore('1');

    expect(result).toEqual(restoredCategory);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: {
        archivedAt: null,
      },
    });
  });

  it('restore rejects non archived expense category', async () => {
    const activeCategory = {
      id: '1',
      name: 'Office',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(activeCategory);

    await expect(service.restore('1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  // DELETE
  it('remove returns removed archived expense category record on success', async () => {
    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedCategory);
    removeMock.mockResolvedValueOnce(archivedCategory);

    const result = await service.remove('1');

    expect(result).toEqual(archivedCategory);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('remove rejects non archived expense category', async () => {
    const activeCategory = {
      id: '1',
      name: 'Office',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(activeCategory);

    await expect(service.remove('1')).rejects.toBeInstanceOf(ConflictException);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('remove rejects deletion when the category is linked to expenses through direct cause', async () => {
    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedCategory);
    removeMock.mockRejectedValueOnce(
      new Error('Foreign key constraint failed', {
        cause: {
          originalCode: '23001',
        },
      }),
    );

    await expect(service.remove('1')).rejects.toMatchObject({
      response: {
        message: 'Expense category cannot be deleted because it has expenses',
      },
    });

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('remove rejects deletion when the category is linked to expenses through driver adapter metadata', async () => {
    const archivedCategory = {
      id: '1',
      name: 'Office',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedCategory);
    removeMock.mockRejectedValueOnce({
      meta: {
        driverAdapterError: {
          cause: {
            code: '23503',
          },
        },
      },
    });

    await expect(service.remove('1')).rejects.toMatchObject({
      response: {
        message: 'Expense category cannot be deleted because it has expenses',
      },
    });

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });
});
