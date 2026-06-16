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

    const result = await service.findAll();

    expect(result).toEqual(vendors);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne returns vendor by id', async () => {
    const id = '1';
    const vendor = { id, name: 'Atlas', archivedAt: null };
    findUniqueOrThrowMock.mockResolvedValueOnce(vendor);

    await expect(service.findOne(id)).resolves.toEqual(vendor);
    expect(findUniqueOrThrowMock).toHaveBeenLastCalledWith({
      where: {
        id,
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

    await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
        archivedAt: null,
      },
    });
  });

  it('findOneIncludingArchived returns vendor by id', async () => {
    const id = '1';
    const vendor = { id, name: 'Atlas', archivedAt: new Date() };
    findUniqueOrThrowMock.mockResolvedValueOnce(vendor);

    await expect(service.findOneIncludingArchived(id)).resolves.toEqual(vendor);
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
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

    await expect(service.findOneIncludingArchived(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: {
        id,
      },
    });
  });

  it('findArchived returns archived vendors ordered by createdAt desc', async () => {
    const vendors = [{ id: '1', name: 'Atlas', archivedAt: new Date() }];
    findManyMock.mockResolvedValue(vendors);

    const result = await service.findArchived();

    expect(result).toEqual(vendors);
    expect(findManyMock).toHaveBeenCalledWith({
      where: {
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
    const result = await service.create(input);
    expect(result).toEqual(vendor);
    expect(createMock).toHaveBeenCalledWith({ data: input });
  });

  it('create throws unique conflict error when a unique field already exists', async () => {
    const input = { name: 'Atlas', email: 'atlas@example.com' };

    createMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(createMock).toHaveBeenCalledWith({ data: input });
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
    await expect(service.update('1', input)).resolves.toEqual(updatedVendor);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
      data: input,
    });
  });

  it('update rejects empty body', async () => {
    await expect(service.update('vendor-id', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('update throws not found exception when vendor does not exist', async () => {
    const input = { email: 'atlas@example.com' };
    updateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Not Found', {
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

  it('update throws unique conflict error when a unique field already exists', async () => {
    const input = { email: 'atlas@example.com' };
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

    const result = await service.archive('1');
    expect(result).toEqual(archivedVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
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

    await expect(service.archive('1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
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

    const result = await service.restore('1');
    expect(result).toEqual(restoredVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: '1' },
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

    await expect(service.restore('1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
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

    const result = await service.remove('1');
    expect(result).toEqual(archivedVendor);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
    expect(removeMock).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('remove rejects non archived vendor', async () => {
    const activeVendor = {
      id: '1',
      name: 'Atlas',
      archivedAt: null,
    };

    findUniqueOrThrowMock.mockResolvedValue(activeVendor);

    await expect(service.remove('1')).rejects.toBeInstanceOf(ConflictException);

    expect(findUniqueOrThrowMock).toHaveBeenCalledWith({
      where: { id: '1' },
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

    await expect(service.remove('1')).rejects.toMatchObject({
      response: {
        message: 'Vendor cannot be deleted because it has expenses',
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
