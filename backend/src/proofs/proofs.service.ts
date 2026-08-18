import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { access, mkdir, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { getExpenseProofDir } from './proofs-paths';
import { Expense, ProofDocument } from '../../generated/prisma/client';

type SupportedProofType = {
  extension: 'jpg' | 'pdf' | 'png';
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  signature: readonly number[];
};

const supportedProofTypes: readonly SupportedProofType[] = [
  {
    extension: 'pdf',
    mimeType: 'application/pdf',
    signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
  },
  {
    extension: 'jpg',
    mimeType: 'image/jpeg',
    signature: [0xff, 0xd8, 0xff],
  },
  {
    extension: 'png',
    mimeType: 'image/png',
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
];

@Injectable()
export class ProofsService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(userId: string, expenseId: string, file: Express.Multer.File) {
    const expenseDir = getExpenseProofDir(expenseId);
    let storagePath: string | undefined;
    try {
      await this.assertExpense(userId, expenseId);
      const proofType = await this.detectProofType(file.path);
      storagePath = join(expenseDir, `${file.filename}.${proofType.extension}`);
      await mkdir(expenseDir, { recursive: true });
      await rename(file.path, storagePath);

      const proof = await this.prisma.proofDocument.create({
        data: {
          expenseId,
          originalName: file.originalname,
          mimeType: proofType.mimeType,
          sizeBytes: file.size,
          storagePath,
        },
      });

      return this.toResponse(proof);
    } catch (error: unknown) {
      if (storagePath !== undefined) {
        await this.unlinkSafely(storagePath);
      }
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

  private async detectProofType(path: string): Promise<SupportedProofType> {
    const contents = await readFile(path);
    const proofType = supportedProofTypes.find(({ signature }) =>
      signature.every((byte, index) => contents[index] === byte),
    );

    if (!proofType) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'file',
            constraints: {
              isFileType: 'Proof file must be a PDF, JPEG, or PNG',
            },
          },
        ],
      });
    }

    return proofType;
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
