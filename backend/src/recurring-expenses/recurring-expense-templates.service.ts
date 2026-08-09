import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RecurrenceFrequency } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { throwPrismaNotFound } from '../common/prisma/prisma-error.util';
import type { CreateRecurringExpenseTemplateDto } from './dto/create-recurring-expense-template.dto';
import type { GetRecurringExpenseTemplatesQueryDto } from './dto/get-recurring-expense-templates-query.dto';
import type { UpdateRecurringExpenseTemplateDto } from './dto/update-recurring-expense-template.dto';

@Injectable()
export class RecurringExpenseTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPage(
    userId: string,
    query: GetRecurringExpenseTemplatesQueryDto = {},
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 6;
    const where = { userId, archivedAt: null };

    const [items, totalItems] = await Promise.all([
      this.prisma.recurringExpenseTemplate.findMany({
        where,
        include: { vendor: true, category: true },
        orderBy: [{ nextDueDate: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.recurringExpenseTemplate.count({ where }),
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

  findArchived(userId: string) {
    return this.prisma.recurringExpenseTemplate.findMany({
      where: { userId, archivedAt: { not: null } },
      include: { vendor: true, category: true },
      orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(userId: string, id: string) {
    try {
      return await this.prisma.recurringExpenseTemplate.findUniqueOrThrow({
        where: { id, userId, archivedAt: null },
        include: { vendor: true, category: true },
      });
    } catch (error) {
      this.handleNotFound(error);
    }
  }

  async create(userId: string, body: CreateRecurringExpenseTemplateDto) {
    await this.assertRelations(userId, body.vendorId, body.categoryId);

    return this.prisma.recurringExpenseTemplate.create({
      data: {
        ...body,
        userId,
        nextDueDate: new Date(body.nextDueDate),
      },
      include: { vendor: true, category: true },
    });
  }

  async update(
    userId: string,
    id: string,
    body: UpdateRecurringExpenseTemplateDto,
  ) {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'body',
            constraints: { isNotEmpty: 'Update body cannot be empty' },
          },
        ],
      });
    }

    const template = await this.findOneIncludingArchived(userId, id);
    await this.assertRelations(
      userId,
      body.vendorId ?? template.vendorId,
      body.categoryId === undefined ? template.categoryId : body.categoryId,
    );

    try {
      return await this.prisma.recurringExpenseTemplate.update({
        where: { id, userId },
        data: {
          ...body,
          nextDueDate:
            body.nextDueDate === undefined
              ? undefined
              : new Date(body.nextDueDate),
        },
        include: { vendor: true, category: true },
      });
    } catch (error) {
      this.handleNotFound(error);
    }
  }

  async archive(userId: string, id: string) {
    const template = await this.findOneIncludingArchived(userId, id);
    if (template.archivedAt !== null) {
      throw new ConflictException({
        message: 'Resource archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This recurring expense template is already archived',
            },
          },
        ],
      });
    }

    return this.prisma.recurringExpenseTemplate.update({
      where: { id, userId },
      data: { archivedAt: new Date() },
    });
  }

  async restore(userId: string, id: string) {
    const template = await this.findOneIncludingArchived(userId, id);
    if (template.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This recurring expense template is not archived',
            },
          },
        ],
      });
    }

    await this.assertRelations(userId, template.vendorId, template.categoryId);
    return this.prisma.recurringExpenseTemplate.update({
      where: { id, userId },
      data: { archivedAt: null },
    });
  }

  async remove(userId: string, id: string) {
    const template = await this.findOneIncludingArchived(userId, id);
    if (template.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists:
                'This recurring expense template should be archived before deletion',
            },
          },
        ],
      });
    }

    return this.prisma.recurringExpenseTemplate.delete({
      where: { id, userId },
    });
  }

  async generateDueExpense(userId: string, id: string) {
    const template = await this.findOne(userId, id);
    const dueDate = template.nextDueDate;
    if (dueDate.getTime() > Date.now()) {
      throw new ConflictException({
        message: 'Recurring expense not due',
        errors: [
          {
            field: 'nextDueDate',
            constraints: { isDue: 'This recurring expense is not due yet' },
          },
        ],
      });
    }

    await this.assertRelations(userId, template.vendorId, template.categoryId);
    const nextDueDate = this.calculateNextDueDate(dueDate, template.frequency);

    return this.prisma.$transaction(async (transaction) => {
      const advanced = await transaction.recurringExpenseTemplate.updateMany({
        where: {
          id,
          userId,
          archivedAt: null,
          nextDueDate: dueDate,
        },
        data: { nextDueDate },
      });

      if (advanced.count === 0) {
        throw new ConflictException({
          message: 'Recurring expense already generated',
        });
      }

      return transaction.expense.create({
        data: {
          userId,
          vendorId: template.vendorId,
          categoryId: template.categoryId,
          recurringExpenseTemplateId: template.id,
          description: template.description,
          amount: template.amount,
          currency: template.currency,
          expenseDate: dueDate,
          notes: template.notes,
        },
      });
    });
  }

  private async findOneIncludingArchived(userId: string, id: string) {
    try {
      return await this.prisma.recurringExpenseTemplate.findUniqueOrThrow({
        where: { id, userId },
      });
    } catch (error) {
      this.handleNotFound(error);
    }
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
      throw new NotFoundException({ message: 'Vendor not found' });
    }

    if (categoryId === undefined || categoryId === null) return;

    const category = await this.prisma.expenseCategory.findUnique({
      where: { id: categoryId },
    });
    if (
      !category ||
      category.userId !== userId ||
      category.archivedAt !== null
    ) {
      throw new NotFoundException({ message: 'Expense category not found' });
    }
  }

  private calculateNextDueDate(dueDate: Date, frequency: RecurrenceFrequency) {
    const nextDueDate = new Date(dueDate);

    if (frequency === RecurrenceFrequency.WEEKLY) {
      nextDueDate.setUTCDate(nextDueDate.getUTCDate() + 7);
      return nextDueDate;
    }

    if (frequency === RecurrenceFrequency.MONTHLY) {
      return this.moveToCalendarPeriod(nextDueDate, 0, 1);
    }

    return this.moveToCalendarPeriod(nextDueDate, 1, 0);
  }

  private moveToCalendarPeriod(dueDate: Date, years: number, months: number) {
    const nextDueDate = new Date(dueDate);
    const dayOfMonth = nextDueDate.getUTCDate();
    nextDueDate.setUTCDate(1);
    nextDueDate.setUTCFullYear(
      nextDueDate.getUTCFullYear() + years,
      nextDueDate.getUTCMonth() + months,
    );
    const lastDayOfMonth = new Date(
      Date.UTC(nextDueDate.getUTCFullYear(), nextDueDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
    nextDueDate.setUTCDate(Math.min(dayOfMonth, lastDayOfMonth));
    return nextDueDate;
  }

  private handleNotFound(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throwPrismaNotFound('Recurring expense template');
    }
    throw error;
  }
}
