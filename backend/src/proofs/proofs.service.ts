import { Injectable, NotFoundException } from '@nestjs/common';
import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(expenseId: string, file: Express.Multer.File) {
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

    const expenseDir = join(process.cwd(), 'uploads', 'proofs', expenseId);
    await mkdir(expenseDir, { recursive: true });

    const finalPath = join(expenseDir, file.filename);
    await rename(file.path, finalPath);

    return this.prisma.proofDocument.create({
      data: {
        expenseId,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: finalPath,
      },
    });
  }
}
