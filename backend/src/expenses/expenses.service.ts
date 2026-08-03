import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Expense } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { throwPrismaNotFound } from '../common/prisma/prisma-error.util';
import type { CreateExpenseDto } from './dto/create-expense.dto';
import type { UpdateExpenseDto } from './dto/update-expense.dto';
import type { GetExpensesQueryDto } from './dto/get-expenses-query.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string, query: GetExpensesQueryDto = {}): Promise<Expense[]> {
    const search = query.search?.trim();
    const expenseDate = this.buildExpenseDateFilter(query);
    const where: Prisma.ExpenseWhereInput = {
      userId,
      archivedAt: null,
      ...(query.vendorId && { vendorId: query.vendorId }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(expenseDate && { expenseDate }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } },
          { vendor: { name: { contains: search, mode: 'insensitive' } } },
          { category: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    return this.prisma.expense.findMany({
      where,
      orderBy: {
        expenseDate: 'desc',
      },
    });
  }

  findArchived(userId: string): Promise<Expense[]> {
    return this.prisma.expense.findMany({
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
      return await this.prisma.expense.findUniqueOrThrow({
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
        throwPrismaNotFound('Expense');
      }
      throw error;
    }
  }

  async findOneDetailed(userId: string, id: string) {
    try {
      return await this.prisma.expense.findUniqueOrThrow({
        where: {
          id,
          userId,
          archivedAt: null,
        },
        include: {
          vendor: true,
          category: true,
          proofs: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Expense');
      }
      throw error;
    }
  }

  async findOneIncludingArchived(userId: string, id: string) {
    try {
      return await this.prisma.expense.findUniqueOrThrow({
        where: { id, userId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Expense');
      }
      throw error;
    }
  }

  async create(userId: string, body: CreateExpenseDto) {
    await this.assertRelations(userId, body.vendorId, body.categoryId);

    return this.prisma.expense.create({
      data: {
        userId,
        vendorId: body.vendorId,
        categoryId: body.categoryId,
        description: body.description,
        amount: body.amount,
        expenseDate: new Date(body.expenseDate),
        notes: body.notes,
      },
    });
  }

  async update(userId: string, id: string, body: UpdateExpenseDto) {
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

    const existingExpense = await this.findOneIncludingArchived(userId, id);

    await this.assertRelations(
      userId,
      body.vendorId ?? existingExpense.vendorId,
      body.categoryId === undefined
        ? existingExpense.categoryId
        : body.categoryId,
    );

    try {
      return await this.prisma.expense.update({
        where: { id, userId },
        data: {
          ...body,
          expenseDate:
            body.expenseDate !== undefined
              ? new Date(body.expenseDate)
              : undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Expense');
      }
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    const expense = await this.findOneIncludingArchived(userId, id);

    if (expense.archivedAt !== null) {
      throw new ConflictException({
        message: 'Resource archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This expense is already archived',
            },
          },
        ],
      });
    }

    return this.prisma.expense.update({
      where: { id, userId },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(userId: string, id: string) {
    const expense = await this.findOneIncludingArchived(userId, id);

    if (expense.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This expense is not archived',
            },
          },
        ],
      });
    }

    await this.assertRelations(userId, expense.vendorId, expense.categoryId);

    return this.prisma.expense.update({
      where: { id, userId },
      data: {
        archivedAt: null,
      },
    });
  }

  async remove(userId: string, id: string) {
    const expense = await this.findOneIncludingArchived(userId, id);

    if (expense.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This expense should be archived in order to be deleted',
            },
          },
        ],
      });
    }

    return this.prisma.expense.delete({
      where: { id, userId },
    });
  }

  private async assertRelations(
    userId: string,
    vendorId: string,
    categoryId?: string | null,
  ) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || vendor.userId !== userId || vendor.archivedAt !== null) {
      throw new NotFoundException({
        message: 'Vendor not found',
      });
    }

    if (categoryId === undefined || categoryId === null) {
      return;
    }

    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });

    if (
      !category ||
      category.userId !== userId ||
      category.archivedAt !== null
    ) {
      throw new NotFoundException({
        message: 'Expense category not found',
      });
    }
  }

  private buildExpenseDateFilter(
    query: GetExpensesQueryDto,
  ): Prisma.DateTimeFilter | undefined {
    if (!query.dateFrom && !query.dateTo) {
      return undefined;
    }

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;

    if (dateTo) {
      dateTo.setUTCHours(23, 59, 59, 999);
    }

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'dateRange',
            constraints: {
              isValid: 'Date From must be before or equal to date To',
            },
          },
        ],
      });
    }

    return {
      ...(dateFrom && { gte: dateFrom }),
      ...(dateTo && { lte: dateTo }),
    };
  }
}
