import { Injectable, NotFoundException } from '@nestjs/common';
import { access, mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { getExpenseProofDir } from './proofs-paths';
import { Expense, ProofDocument } from '../../generated/prisma/client';

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(userId: string, expenseId: string, file: Express.Multer.File) {
    const expenseDir = getExpenseProofDir(expenseId);
    const storagePath = join(expenseDir, file.filename);
    try {
      await this.assertExpense(userId, expenseId);
      await mkdir(expenseDir, { recursive: true });
      await rename(file.path, storagePath);

      const proof = await this.prisma.proofDocument.create({
        data: {
          expenseId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath,
        },
      });

      return this.toResponse(proof);
    } catch (error: unknown) {
      await this.unlinkSafely(storagePath);
      await this.unlinkSafely(file.path);

      throw error;
    }
  }

  async getDownload(userId: string, expenseId: string, proofId: string) {
    await this.assertExpense(userId, expenseId);

    const proof = await this.assertProofDocument(expenseId, proofId);
    const absolutePath = proof.storagePath;

    try {
      await access(absolutePath);
    } catch {
      throw new NotFoundException({
        message: 'Proof file not found',
      });
    }

    return {
      proof,
      absolutePath,
    };
  }

  async remove(userId: string, expenseId: string, proofId: string) {
    await this.assertExpense(userId, expenseId);

    const proof = await this.assertProofDocument(expenseId, proofId);
    const absolutePath = proof.storagePath;

    await this.unlinkSafely(absolutePath);

    return this.prisma.proofDocument.delete({
      where: { id: proofId },
    });
  }

  private async unlinkSafely(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      //
    }
  }

  private toResponse(proof: ProofDocument) {
    return {
      id: proof.id,
      expenseId: proof.expenseId,
      originalName: proof.originalName,
      mimeType: proof.mimeType,
      sizeBytes: proof.sizeBytes,
      createdAt: proof.createdAt,
    };
  }

  private async assertExpense(
    userId: string,
    expenseId: string,
  ): Promise<Expense> {
    const expense = await this.prisma.expense.findUnique({
      where: {
        id: expenseId,
        userId,
        archivedAt: null,
      },
    });

    if (!expense) {
      throw new NotFoundException({
        message: 'Expense not found',
      });
    }

    return expense;
  }

  private async assertProofDocument(
    expenseId: string,
    proofId: string,
  ): Promise<ProofDocument> {
    const proof = await this.prisma.proofDocument.findUnique({
      where: { id: proofId, expenseId },
    });

    if (!proof) {
      throw new NotFoundException({
        message: 'Proof document not found',
      });
    }

    return proof;
  }
}
