import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type ExpenseCategory } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  throwPrismaConflict,
  throwPrismaNotFound,
} from '../common/prisma/prisma-error.util';
import type { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import type { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findArchived(): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        archivedAt: {
          not: null,
        },
      },
      orderBy: {
        archivedAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    try {
      return await this.prisma.expenseCategory.findUniqueOrThrow({
        where: {
          id,
          archivedAt: null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Expense category');
      }
      throw error;
    }
  }

  async findOneIncludingArchived(id: string) {
    try {
      return await this.prisma.expenseCategory.findUniqueOrThrow({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Expense category');
      }
      throw error;
    }
  }

  async create(body: CreateExpenseCategoryDto) {
    try {
      return await this.prisma.expenseCategory.create({
        data: body,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throwPrismaConflict(error, 'expense category');
      }
      throw error;
    }
  }

  async update(id: string, body: UpdateExpenseCategoryDto) {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'body',
            constraints: {
              isNotEmpty: 'Update body cannot be empty',
            },
          },
        ],
      });
    }

    try {
      return await this.prisma.expenseCategory.update({
        where: { id },
        data: body,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throwPrismaNotFound('Expense category');
        }
        if (error.code === 'P2002') {
          throwPrismaConflict(error, 'expense category');
        }
      }
      throw error;
    }
  }

  async archive(id: string) {
    const category = await this.findOneIncludingArchived(id);

    if (category.archivedAt !== null) {
      throw new ConflictException({
        message: 'Resource archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This expense category is already archived',
            },
          },
        ],
      });
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string) {
    const category = await this.findOneIncludingArchived(id);

    if (category.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This expense category is not archived',
            },
          },
        ],
      });
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        archivedAt: null,
      },
    });
  }
  async remove(id: string) {
    const category = await this.findOneIncludingArchived(id);

    if (category.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists:
                'This expense category should be archived in order to be deleted',
            },
          },
        ],
      });
    }

    try {
      return await this.prisma.expenseCategory.delete({
        where: { id },
      });
    } catch (error: unknown) {
      const prismaError = error as {
        cause?: {
          originalCode?: string;
          code?: string;
        };
        meta?: {
          driverAdapterError?: {
            cause?: {
              originalCode?: string;
              code?: string;
            };
          };
        };
      };

      const directCause = prismaError.cause;
      const adapterCause = prismaError.meta?.driverAdapterError?.cause;

      const codes = [
        directCause?.originalCode,
        directCause?.code,
        adapterCause?.originalCode,
        adapterCause?.code,
      ];

      if (codes.includes('23001') || codes.includes('23503')) {
        throw new ConflictException({
          message: 'Expense category cannot be deleted because it has expenses',
        });
      }

      throw error;
    }
  }
}
