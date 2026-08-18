import { BadRequestException, NotFoundException } from '@nestjs/common';
import { access, mkdir, readFile, rename, unlink } from 'node:fs/promises';
import { ProofsService } from './proofs.service';
import { PrismaService } from '../../prisma/prisma.service';
import { join } from 'node:path';
import { getExpenseProofDir } from './proofs-paths';

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn(),
  rename: jest.fn(),
  unlink: jest.fn(),
}));

describe('ProofsService', () => {
  let service: ProofsService;
  const userId = 'user-1';

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
      userId,
    });
    jest.mocked(readFile).mockResolvedValueOnce(Buffer.from('%PDF-1.7'));

    const expectedDirectory = getExpenseProofDir('expense-1');

    const expectedPath = join(expectedDirectory, 'generated-file-name.pdf');

    const createdProof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.txt',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: expectedPath,
      createdAt: new Date(),
    };

    proofCreateMock.mockResolvedValueOnce(createdProof);

    const file = {
      originalname: 'invoice.txt',
      mimetype: 'text/plain',
      size: 245760,
      filename: 'generated-file-name',
      path: '/tmp/generated-file-name',
    } as Express.Multer.File;

    const result = await service.upload(userId, 'expense-1', file);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 'expense-1',
        userId,
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
        originalName: 'invoice.txt',
        mimeType: 'application/pdf',
        sizeBytes: 245760,
        storagePath: expectedPath,
      },
    });

    expect(result).toEqual({
      id: createdProof.id,
      expenseId: createdProof.expenseId,
      originalName: createdProof.originalName,
      mimeType: createdProof.mimeType,
      sizeBytes: createdProof.sizeBytes,
      createdAt: createdProof.createdAt,
    });
  });

  it('rejects unsupported file content and removes the temporary upload', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce({
      id: 'expense-1',
      userId,
    });
    jest.mocked(readFile).mockResolvedValueOnce(Buffer.from('plain text'));

    const file = {
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      size: 10,
      filename: 'generated-file-name',
      path: '/tmp/generated-file-name',
    } as Express.Multer.File;

    await expect(
      service.upload(userId, 'expense-1', file),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(unlink).toHaveBeenCalledWith(file.path);
    expect(mkdir).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(proofCreateMock).not.toHaveBeenCalled();
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

    await expect(
      service.upload(userId, 'expense-1', file),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(unlink).toHaveBeenCalledWith(file.path);
    expect(mkdir).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
    expect(proofCreateMock).not.toHaveBeenCalled();
  });

  it('returns an owned proof download path', async () => {
    const proof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: join(
        getExpenseProofDir('expense-1'),
        'generated-file-name.pdf',
      ),
      createdAt: new Date('2026-06-19T10:00:00.000Z'),
    };

    expenseFindUniqueMock.mockResolvedValueOnce({
      id: proof.expenseId,
      userId,
    });
    proofFindUniqueMock.mockResolvedValueOnce(proof);

    const result = await service.getDownload(userId, proof.expenseId, proof.id);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: proof.expenseId,
        userId,
        archivedAt: null,
      },
    });
    expect(proofFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: proof.id,
        expenseId: proof.expenseId,
      },
    });
    expect(access).toHaveBeenCalledWith(
      expect.stringContaining('generated-file-name.pdf'),
    );
    expect(result.proof).toEqual(proof);
    expect(result.absolutePath).toContain('generated-file-name.pdf');
  });

  it('rejects a download when the stored proof file is missing', async () => {
    const proof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: join(
        getExpenseProofDir('expense-1'),
        'generated-file-name.pdf',
      ),
      createdAt: new Date('2026-06-19T10:00:00.000Z'),
    };

    expenseFindUniqueMock.mockResolvedValueOnce({
      id: proof.expenseId,
      userId,
    });
    proofFindUniqueMock.mockResolvedValueOnce(proof);
    jest.mocked(access).mockRejectedValueOnce(new Error('Missing file'));

    await expect(
      service.getDownload(userId, proof.expenseId, proof.id),
    ).rejects.toMatchObject({
      response: {
        message: 'Proof file not found',
      },
    });
  });

  it('removes an existing proof document', async () => {
    const proof = {
      id: 'proof-1',
      expenseId: 'expense-1',
      originalName: 'invoice.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 245760,
      storagePath: join(
        getExpenseProofDir('expense-1'),
        'generated-file-name.pdf',
      ),
      createdAt: new Date('2026-06-19T10:00:00.000Z'),
    };
    expenseFindUniqueMock.mockResolvedValueOnce({
      id: proof.expenseId,
      userId,
    });
    proofFindUniqueMock.mockResolvedValueOnce(proof);

    proofDeleteMock.mockResolvedValueOnce(proof);

    const result = await service.remove(userId, proof.expenseId, proof.id);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: proof.expenseId, userId, archivedAt: null },
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
      service.remove(userId, 'no-expense', 'proof-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'no-expense', userId, archivedAt: null },
    });
    expect(proofFindUniqueMock).not.toHaveBeenCalled();
    expect(proofDeleteMock).not.toHaveBeenCalled();
  });

  it('rejects removing a proof document that does not exist', async () => {
    expenseFindUniqueMock.mockResolvedValueOnce({ id: 'expense-1', userId });
    proofFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.remove(userId, 'expense-1', 'no-proof-id'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(expenseFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'expense-1', userId, archivedAt: null },
    });
    expect(proofFindUniqueMock).toHaveBeenCalledWith({
      where: { id: 'no-proof-id', expenseId: 'expense-1' },
    });
    expect(proofDeleteMock).not.toHaveBeenCalled();
  });
});
