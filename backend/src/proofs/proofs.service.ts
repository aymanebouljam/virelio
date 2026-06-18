import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(expenseId: string, file: Express.Multer.File) {
    const expenseDir = join(process.cwd(), 'uploads', 'proofs', expenseId);
    const finalPath = join(expenseDir, file.filename);
    try {
      const expense = await this.prisma.expense.findUnique({
        where: {
          id: expenseId,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!expense) {
        throw new NotFoundException({
          message: 'Expense not found',
        });
      }

      await mkdir(expenseDir, { recursive: true });
      await rename(file.path, finalPath);

      return await this.prisma.proofDocument.create({
        data: {
          expenseId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath: finalPath,
        },
      });
    } catch (error: unknown) {
      await this.unlinkSafely(finalPath);
      await this.unlinkSafely(file.path);

      throw error;
    }
  }

  private async unlinkSafely(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      //
    }
  }
}
