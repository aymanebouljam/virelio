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
import type { GetExpenseCategoriesPageQueryDto } from './dto/get-expense-categories-page-query.dto';
import type { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPage(userId: string, query: GetExpenseCategoriesPageQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 6;
    const where = { userId, archivedAt: null };

    const [items, totalItems] = await Promise.all([
      this.prisma.expenseCategory.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expenseCategory.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  findArchived(userId: string): Promise<ExpenseCategory[]> {
    return this.prisma.expenseCategory.findMany({
      where: {
        userId,
        archivedAt: {
          not: null,
        },
      },
      orderBy: {
        archivedAt: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    try {
      return await this.prisma.expenseCategory.findUniqueOrThrow({
        where: {
          id,
          userId,
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

  async findOneIncludingArchived(userId: string, id: string) {
    try {
      return await this.prisma.expenseCategory.findUniqueOrThrow({
        where: { id, userId },
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

  async create(userId: string, body: CreateExpenseCategoryDto) {
    try {
      return await this.prisma.expenseCategory.create({
        data: {
          ...body,
          userId,
        },
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

  async update(userId: string, id: string, body: UpdateExpenseCategoryDto) {
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
        where: { id, userId },
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

  async archive(userId: string, id: string) {
    const category = await this.findOneIncludingArchived(userId, id);

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
      where: { id, userId },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(userId: string, id: string) {
    const category = await this.findOneIncludingArchived(userId, id);

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
      where: { id, userId },
      data: {
        archivedAt: null,
      },
    });
  }
  async remove(userId: string, id: string) {
    const category = await this.findOneIncludingArchived(userId, id);

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
        where: { id, userId },
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
