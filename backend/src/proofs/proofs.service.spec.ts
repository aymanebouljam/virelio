import { NotFoundException } from '@nestjs/common';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { ProofsService } from './proofs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'node:path';
import { getExpenseProofDir } from './proofs-paths';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  rename: jest.fn(),
  unlink: jest.fn(),
}));

describe('ProofsService', () => {
  let service: ProofsService;

  const expenseFindUniqueMock = jest.fn();
  const proofCreateMock = jest.fn();
  const proofFindUniqueMock = jest.fn();
  const proofDeleteMock = jest.fn();

  const prisma = {
    expense: {
      findUnique: expenseFindUniqueMock,
    },
    proofDocument: {
      create: proofCreateMock,
      findUnique: proofFindUniqueMock,
      delete: proofDeleteMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProofsService(prisma);
  });

  it('uploads proof metadata for an existing active expense', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce({
      id: 'expense-1',
    });

    const expectedDirectory = getExpenseProofDir('expense-1');

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

  it('removes an existing proof document', async () => {
    const proof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: 'uploads/proofs/expense-1/generated-file-name.pdf',
      createdAt: new Date('2026-06-19T10:00:00.000Z'),
    };
    expenseFindUniqueMock.mockResolvedValueOnce({ id: proof.expenseId });
    proofFindUniqueMock.mockResolvedValueOnce(proof);

    proofDeleteMock.mockResolvedValueOnce(proof);

    const result = await service.remove(proof.expenseId, proof.id);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: proof.expenseId, archivedAt: null },
    });
    expect(proofFindUniqueMock).toHaveBeenCalledWith({
      where: { id: proof.id, expenseId: proof.expenseId },
    });
    expect(proofDeleteMock).toHaveBeenCalledWith({
      where: { id: proof.id },
    });
    expect(result).toMatchObject(proof);
  });
  it('rejects removing a proof document when the expense does not exist', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.remove('no-expense', 'proof-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'no-expense', archivedAt: null },
    });
    expect(proofFindUniqueMock).not.toHaveBeenCalled();
    expect(proofDeleteMock).not.toHaveBeenCalled();
  });

  it('rejects removing a proof document that does not exist', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce({ id: 'expense-1' });
    proofFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.remove('expense-1', 'no-proof-id'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', archivedAt: null },
    });
    expect(proofFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'no-proof-id', expenseId: 'expense-1' },
    });
    expect(proofDeleteMock).not.toHaveBeenCalled();
  });
});
