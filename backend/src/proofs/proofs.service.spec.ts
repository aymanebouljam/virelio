import { NotFoundException } from '@nestjs/common';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { ProofsService } from './proofs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'node:path';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  rename: jest.fn(),
  unlink: jest.fn(),
}));

describe('ProofsService', () => {
  let service: ProofsService;

  const expenseFindUniqueMock = jest.fn();
  const proofCreateMock = jest.fn();

  const prisma = {
    expense: {
      findUnique: expenseFindUniqueMock,
    },
    proofDocument: {
      create: proofCreateMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProofsService(prisma);
  });

  it('uploads proof metadata for an existing active expense', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce({
      id: 'expense-1',
    });

    const expectedDirectory = join(
      process.cwd(),
      'uploads',
      'proofs',
      'expense-1',
    );

    const expectedPath = join(expectedDirectory, 'generated-file-name.pdf');

    const createdProof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: 'uploads/proofs/expense-1/generated-file-name.pdf',
      createdAt: new Date(),
    };

    proofCreateMock.mockResolvedValueOnce(createdProof);

    const file = {
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      size: 245760,
      filename: 'generated-file-name.pdf',
      path: '/tmp/generated-file-name.pdf',
    } as Express.Multer.File;

    const result = await service.upload('expense-1', file);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 'expense-1',
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    expect(mkdir).toHaveBeenCalledWith(expectedDirectory, {
      recursive: true,
    });

    expect(rename).toHaveBeenCalledWith(file.path, expectedPath);

    expect(proofCreateMock).toHaveBeenCalledWith({
      data: {
        expenseId: 'expense-1',
        originalName: 'invoice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 245760,
        storagePath: 'uploads/proofs/expense-1/generated-file-name.pdf',
      },
    });

    expect(result).toEqual(createdProof);
  });

  it('rejects upload when expense does not exist', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce(null);

    const file = {
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      size: 245760,
      filename: 'generated-file-name.pdf',
      path: '/tmp/generated-file-name.pdf',
    } as Express.Multer.File;

    await expect(service.upload('expense-1', file)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(unlink).toHaveBeenCalledWith(file.path);
    expect(mkdir).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(proofCreateMock).not.toHaveBeenCalled();
  });
});
