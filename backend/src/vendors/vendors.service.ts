import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, type Vendor } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateVendorDto } from './dto/create-vendor.dto';
import type { UpdateVendorDto } from './dto/update-vendor.dto';
import {
  throwPrismaConflict,
  throwPrismaNotFound,
} from '../common/prisma/prisma-error.util';

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    try {
      return await this.prisma.vendor.findUniqueOrThrow({
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
        throwPrismaNotFound('Vendor');
      }
      throw error;
    }
  }
  findArchived(): Promise<Vendor[]> {
    return this.prisma.vendor.findMany({
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
  async findOneIncludingArchived(id: string) {
    try {
      return await this.prisma.vendor.findUniqueOrThrow({
        where: {
          id,
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

  async create(body: CreateVendorDto) {
    try {
      return await this.prisma.vendor.create({
        data: body,
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

  async update(id: string, body: UpdateVendorDto) {
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
        where: { id },
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

  async archive(id: string) {
    const vendor = await this.findOneIncludingArchived(id);
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
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async restore(id: string) {
    const vendor = await this.findOneIncludingArchived(id);
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
      where: { id },
      data: {
        archivedAt: null,
      },
    });
  }

  async remove(id: string) {
    const vendor = await this.findOneIncludingArchived(id);

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
        where: { id },
      });
    } catch (error: unknown) {
      const cause = (
        error as {
          cause?: {
            originalCode?: string;
            code?: string;
          };
        }
      )?.cause;

      if (
        cause?.originalCode === '23001' ||
        cause?.code === '23001' ||
        cause?.originalCode === '23503' ||
        cause?.code === '23503'
      ) {
        throw new ConflictException({
          message: 'Vendor cannot be deleted because it has expenses',
        });
      }

      throw error;
    }
  }
}
