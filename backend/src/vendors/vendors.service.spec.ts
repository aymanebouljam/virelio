import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

describe('VendorsService', () => {
  let service: VendorsService;
  const userId = 'user-1';

  const findManyMock = jest.fn();
  const findFirstOrThrowMock = jest.fn();
  const findUniqueOrThrowMock = jest.fn();
  const createMock = jest.fn();
  const updateMock = jest.fn();
  const removeMock = jest.fn();

  const prisma = {
    vendor: {
      findMany: findManyMock,
      findFirstOrThrow: findFirstOrThrowMock,
      findUniqueOrThrow: findUniqueOrThrowMock,
      create: createMock,
      update: updateMock,
      delete: removeMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VendorsService(prisma);
  });

  // READ
  it('findAll returns active vendors ordered by createdAt desc', async () => {
    const vendors = [{ id: '1', name: 'Atlas', archivedAt: null }];
    findManyMock.mockResolvedValue(vendors);

    const result = await service.findAll(userId);

    expect(result).toEqual(vendors);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { archivedAt: null, userId },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll searches active vendor contact fields case-insensitively', async () => {
    const vendors = [{ id: '1', name: 'Atlas', archivedAt: null }];
    findManyMock.mockResolvedValue(vendors);

    await expect(
      service.findAll(userId, { search: '  atlas  ' }),
    ).resolves.toEqual(vendors);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        archivedAt: null,
        userId,
        OR: [
          { name: { contains: 'atlas', mode: 'insensitive' } },
          { email: { contains: 'atlas', mode: 'insensitive' } },
          { phone: { contains: 'atlas', mode: 'insensitive' } },
          { website: { contains: 'atlas', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAll ignores a blank search value', async () => {
    findManyMock.mockResolvedValue([]);

    await service.findAll(userId, { search: '   ' });

    expect(findManyMock).toHaveBeenCalledWith({
      where: { archivedAt: null, userId },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne returns vendor by id', async () => {
    const id = '1';
    const vendor = { id, name: 'Atlas', archivedAt: null };
    findUniqueOrThrowMock.mockResolvedValueOnce(vendor);

    await expect(service.findOne(userId, id)).resolves.toEqual(vendor);
    expect(findUniqueOrThrowMock).toHaveBeenLastCalledWith({
      where: {
        id,
        userId,
        archivedAt: null,
      },
    });
  });

  it('findOne throws not found exception for non existent vendor id', async () => {
    const id = '999';
    findUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(service.findOne(userId, id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        userId,
        archivedAt: null,
      },
    });
  });

  it('findOneIncludingArchived returns vendor by id', async () => {
    const id = '1';
    const vendor = { id, name: 'Atlas', archivedAt: new Date() };
    findUniqueOrThrowMock.mockResolvedValueOnce(vendor);

    await expect(service.findOneIncludingArchived(userId, id)).resolves.toEqual(
      vendor,
    );
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        userId,
      },
    });
  });

  it('findOneIncludingArchived throws not found exception for non existent vendor id', async () => {
    const id = '999';
    findUniqueOrThrowMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.findOneIncludingArchived(userId, id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        userId,
      },
    });
  });

  it('findArchived returns archived vendors ordered by createdAt desc', async () => {
    const vendors = [{ id: '1', name: 'Atlas', archivedAt: new Date() }];
    findManyMock.mockResolvedValue(vendors);

    const result = await service.findArchived(userId);

    expect(result).toEqual(vendors);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId,
        archivedAt: {
          not: null,
        },
      },
      orderBy: { archivedAt: 'desc' },
    });
  });

  // Create

  it('create returns new stored vendor', async () => {
    const input = { name: 'Atlas', email: 'atlas@example.com' };
    const vendor = { ...input, id: '1', archivedAt: null };
    createMock.mockResolvedValueOnce(vendor);
    const result = await service.create(userId, input);
    expect(result).toEqual(vendor);
    expect(createMock).toHaveBeenCalledWith({ data: { ...input, userId } });
  });

  it('create throws unique conflict error when a unique field already exists', async () => {
    const input = { name: 'Atlas', email: 'atlas@example.com' };

    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(userId, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(createMock).toHaveBeenCalledWith({ data: { ...input, userId } });
  });

  // update

  it('update returns updated vendor', async () => {
    const input = { email: 'atlas@example.com' };
    const updatedVendor = {
      id: '1',
      name: 'Atlas',
      email: 'atlas@example.com',
      archivedAt: null,
    };
    updateMock.mockResolvedValueOnce(updatedVendor);
    await expect(service.update(userId, '1', input)).resolves.toEqual(
      updatedVendor,
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
      data: input,
    });
  });

  it('update rejects empty body', async () => {
    await expect(
      service.update(userId, 'vendor-id', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update throws not found exception when vendor does not exist', async () => {
    const input = { email: 'atlas@example.com' };
    updateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Not Found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    await expect(service.update(userId, '1', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
      data: input,
    });
  });

  it('update throws unique conflict error when a unique field already exists', async () => {
    const input = { email: 'atlas@example.com' };
    updateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.update(userId, '1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
      data: input,
    });
  });

  it('archive returns archived vendor', async () => {
    const vendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: null,
    };

    const archivedVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValue(vendor);
    updateMock.mockResolvedValue(archivedVendor);

    const result = await service.archive(userId, '1');
    expect(result).toEqual(archivedVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
      data: { archivedAt: expect.any(Date) as unknown },
    });
  });

  it('archive rejects already archived vendor', async () => {
    const archived = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValue(archived);

    await expect(service.archive(userId, '1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('restore returns restored vendor', async () => {
    const vendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    const restoredVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValue(vendor);
    updateMock.mockResolvedValue(restoredVendor);

    const result = await service.restore(userId, '1');
    expect(result).toEqual(restoredVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
      data: { archivedAt: null },
    });
  });

  it('restore rejects non archived vendor', async () => {
    const activeVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValue(activeVendor);

    await expect(service.restore(userId, '1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });

    expect(updateMock).not.toHaveBeenCalled();
  });

  // Delete
  it('returns removed archived vendor record on success', async () => {
    const archivedVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedVendor);
    removeMock.mockResolvedValueOnce(archivedVendor);

    const result = await service.remove(userId, '1');
    expect(result).toEqual(archivedVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
  });

  it('remove rejects non archived vendor', async () => {
    const activeVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValue(activeVendor);

    await expect(service.remove(userId, '1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('remove rejects deletion when the vendor is linked to expenses', async () => {
    const archivedVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedVendor);
    removeMock.mockRejectedValueOnce(
      new Error('Foreign key constraint failed', {
        cause: {
          originalCode: '23001',
        },
      }),
    );

    await expect(service.remove(userId, '1')).rejects.toMatchObject({
      response: {
        message: 'Vendor cannot be deleted because it has expenses',
      },
    });

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
  });
  it('remove rejects deletion when the vendor is linked to expenses through driver adapter metadata', async () => {
    const archivedVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: new Date(),
    };

    findUniqueOrThrowMock.mockResolvedValueOnce(archivedVendor);
    removeMock.mockRejectedValueOnce({
      meta: {
        driverAdapterError: {
          cause: {
            code: '23503',
          },
        },
      },
    });

    await expect(service.remove(userId, '1')).rejects.toMatchObject({
      response: {
        message: 'Vendor cannot be deleted because it has expenses',
      },
    });

    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1', userId },
    });
  });
});
