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

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Expense[]> {
    return this.prisma.expense.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        expenseDate: 'desc',
      },
    });
  }

  findArchived(): Promise<Expense[]> {
    return this.prisma.expense.findMany({
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
      return await this.prisma.expense.findUniqueOrThrow({
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
        throwPrismaNotFound('Expense');
      }
      throw error;
    }
  }

  async findOneIncludingArchived(id: string) {
    try {
      return await this.prisma.expense.findUniqueOrThrow({
        where: { id },
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

  async create(body: CreateExpenseDto) {
    await this.assertRelations(body.vendorId, body.categoryId);

    return this.prisma.expense.create({
      data: {
        vendorId: body.vendorId,
        categoryId: body.categoryId,
        description: body.description,
        amount: body.amount,
        expenseDate: new Date(body.expenseDate),
        notes: body.notes,
      },
    });
  }

  async update(id: string, body: UpdateExpenseDto) {
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

    const existingExpense = await this.findOneIncludingArchived(id);

    await this.assertRelations(
      body.vendorId ?? existingExpense.vendorId,
      body.categoryId === undefined
        ? existingExpense.categoryId
        : body.categoryId,
    );

    try {
      return await this.prisma.expense.update({
        where: { id },
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

  async archive(id: string) {
    const expense = await this.findOneIncludingArchived(id);

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
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string) {
    const expense = await this.findOneIncludingArchived(id);

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

    await this.assertRelations(expense.vendorId, expense.categoryId);

    return this.prisma.expense.update({
      where: { id },
      data: {
        archivedAt: null,
      },
    });
  }

  async remove(id: string) {
    const expense = await this.findOneIncludingArchived(id);

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
      where: { id },
    });
  }

  private async assertRelations(vendorId: string, categoryId?: string | null) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor || vendor.archivedAt !== null) {
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

    if (!category || category.archivedAt !== null) {
      throw new NotFoundException({
        message: 'Expense category not found',
      });
    }
  }
}
