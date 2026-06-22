import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { getAbsoluteProofPath, getExpenseProofDir } from './proofs-paths';
import { Expense, ProofDocument } from '../../generated/prisma/client';

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(expenseId: string, file: Express.Multer.File) {
    const expenseDir = getExpenseProofDir(expenseId);
    const finalPath = join(expenseDir, file.filename);
    const publicPath = `uploads/proofs/${expenseId}/${file.filename}`;
    try {
      await this.assertExpense(expenseId);
      await mkdir(expenseDir, { recursive: true });
      await rename(file.path, finalPath);

      return await this.prisma.proofDocument.create({
        data: {
          expenseId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath: publicPath,
        },
      });
    } catch (error: unknown) {
      await this.unlinkSafely(finalPath);
      await this.unlinkSafely(file.path);

      throw error;
    }
  }

  async remove(expenseId: string, proofId: string) {
    await this.assertExpense(expenseId);

    const proof = await this.assertProofDocument(expenseId, proofId);
    const absolutePath = getAbsoluteProofPath(proof.storagePath);

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

  private async assertExpense(expenseId: string): Promise<Expense> {
    const expense = await this.prisma.expense.findUnique({
      where: {
        id: expenseId,
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
      where: { id: proofId, expenseId: expenseId },
    });

    if (!proof) {
      throw new NotFoundException({
        message: 'Proof document not found',
      });
    }

    return proof;
  }
}
