import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';

type PrismaUniqueMeta = {
  target?: unknown;
  driverAdapterError?: {
    cause?: {
      constraint?: {
        fields?: unknown;
      };
    };
  };
};
export function throwPrismaConflict(
  error: Prisma.PrismaClientKnownRequestError,
  resource: string,
): never {
  const meta = error.meta as PrismaUniqueMeta | undefined;

  const target =
    meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields;
  const rawFields = Array.isArray(target)
    ? target.filter((field): field is string => typeof field === 'string')
    : typeof target === 'string'
      ? [target]
      : [];
  const normalizeField = (field: string) =>
    field.startsWith('"') && field.endsWith('"') ? field.slice(1, -1) : field;

  const fields = rawFields
    .map(normalizeField)
    .filter((field) => field !== 'userId');

  throw new ConflictException({
    message: 'Validation failed',
    errors: fields.length
      ? fields.map((field) => ({
          field,
          constraints: {
            isUnique: `A ${resource} with this ${field} already exists`,
          },
        }))
      : [
          {
            field: 'unknown',
            constraints: {
              isUnique: `A ${resource} with the provided details already exists`,
            },
          },
        ],
  });
}

export function throwPrismaNotFound(resource: string): never {
  throw new NotFoundException({
    message: `${resource} not found`,
  });
}
