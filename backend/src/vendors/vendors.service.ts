import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type Vendor } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateVendorDto } from './dto/create-vendor.dto';
import type { UpdateVendorDto } from './dto/update-vendor.dto';
import type { GetVendorsPageQueryDto } from './dto/get-vendors-query.dto';
import {
  throwPrismaConflict,
  throwPrismaNotFound,
} from '../common/prisma/prisma-error.util';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      where: this.buildActiveVendorFilter(userId),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findPage(userId: string, query: GetVendorsPageQueryDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = this.buildActiveVendorFilter(userId, query.search);

    const [items, totalItems] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vendor.count({ where }),
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

  async findOne(userId: string, id: string) {
    try {
      return await this.prisma.vendor.findUniqueOrThrow({
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
        throwPrismaNotFound('Vendor');
      }
      throw error;
    }
  }
  findArchived(userId: string): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
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
  async findOneIncludingArchived(userId: string, id: string) {
    try {
      return await this.prisma.vendor.findUniqueOrThrow({
        where: {
          id,
          userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throwPrismaNotFound('Vendor');
      }
      throw error;
    }
  }

  async create(userId: string, body: CreateVendorDto) {
    try {
      return await this.prisma.vendor.create({
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
        throwPrismaConflict(error, 'vendor');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, body: UpdateVendorDto) {
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
      return await this.prisma.vendor.update({
        where: { id, userId },
        data: body,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throwPrismaNotFound('Vendor');
        }
        if (error.code === 'P2002') {
          throwPrismaConflict(error, 'vendor');
        }
      }
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    const vendor = await this.findOneIncludingArchived(userId, id);
    if (vendor.archivedAt !== null) {
      throw new ConflictException({
        message: 'Resource archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor is already archived',
            },
          },
        ],
      });
    }
    return this.prisma.vendor.update({
      where: { id, userId },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(userId: string, id: string) {
    const vendor = await this.findOneIncludingArchived(userId, id);
    if (vendor.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor is not archived',
            },
          },
        ],
      });
    }
    return this.prisma.vendor.update({
      where: { id, userId },
      data: {
        archivedAt: null,
      },
    });
  }

  async remove(userId: string, id: string) {
    const vendor = await this.findOneIncludingArchived(userId, id);

    if (vendor.archivedAt === null) {
      throw new ConflictException({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor should be archived in order to be deleted',
            },
          },
        ],
      });
    }

    try {
      return await this.prisma.vendor.delete({
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
              constraint?: {
                fields?: unknown;
              };
            };
          };
        };
        message?: string;
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
          message: 'Vendor cannot be deleted because it has expenses',
        });
      }
      throw error;
    }
  }

  private buildActiveVendorFilter(
    userId: string,
    search?: string,
  ): Prisma.VendorWhereInput {
    const normalizedSearch = search?.trim();

    return {
      archivedAt: null,
      userId,
      ...(normalizedSearch && {
        OR: [
          { name: { contains: normalizedSearch, mode: 'insensitive' } },
          { email: { contains: normalizedSearch, mode: 'insensitive' } },
          { phone: { contains: normalizedSearch, mode: 'insensitive' } },
          { website: { contains: normalizedSearch, mode: 'insensitive' } },
        ],
      }),
    };
  }
}
