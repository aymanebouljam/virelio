import request from 'supertest';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import { createAuthHeader } from './test-auth';

type ExpenseCategoryResponse = {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type ErrorResponse = {
  message: string;
  errors?: {
    field: string;
    constraints: Record<string, string>;
  }[];
};

describe('ExpenseCategories e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    authHeaders = await createAuthHeader(http);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app?.close();
  });

  describe('GET /expense-categories', () => {
    it('returns empty list initially', async () => {
      const response = await request(http)
        .get('/expense-categories')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });

    it('returns active expense categories only', async () => {
      const inputA = {
        name: 'Office',
        color: '#64748b',
      };

      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const inputB = {
        name: 'Travel',
        color: '#0f766e',
      };

      await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/expense-categories')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const categories = listResponse.body as ExpenseCategoryResponse[];

      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject(inputB);
      expect(categories[0].archivedAt).toBeNull();
      expect(categories.some((category) => category.name === inputA.name)).toBe(
        false,
      );
    });

    it('lists the most recently created active expense categories first', async () => {
      const createResponseA = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const categoryA = createResponseA.body as ExpenseCategoryResponse;

      await prisma.expenseCategory.update({
        where: { id: categoryA.id },
        data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      });

      const createResponseB = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Travel',
          color: '#0f766e',
        })
        .expect(HttpStatus.CREATED);

      const categoryB = createResponseB.body as ExpenseCategoryResponse;

      await prisma.expenseCategory.update({
        where: { id: categoryB.id },
        data: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
      });

      const listResponse = await request(http)
        .get('/expense-categories')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const categories = listResponse.body as ExpenseCategoryResponse[];

      expect(categories.map(({ id }) => id)).toEqual([
        categoryB.id,
        categoryA.id,
      ]);
    });
  });

  describe('GET /expense-categories/:id', () => {
    it('returns the category when it exists and is active', async () => {
      const input = {
        name: 'Office',
        color: '#64748b',
      };

      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      const response = await request(http)
        .get(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const category = response.body as ExpenseCategoryResponse;

      expect(category).toMatchObject(input);
      expect(category.id).toBe(createdCategory.id);
      expect(category.archivedAt).toBeNull();
    });

    it('returns 400 when the category ID is not a valid UUID', async () => {
      const response = await request(http)
        .get('/expense-categories/not-a-uuid')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the category does not exist', async () => {
      const response = await request(http)
        .get(`/expense-categories/${randomUUID()}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });

    it('returns 404 when the category is archived', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });
  });

  describe('GET /expense-categories/archived', () => {
    it('returns an empty array when no archived categories exist', async () => {
      const response = await request(http)
        .get('/expense-categories/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });

    it('returns archived expense categories only', async () => {
      const inputA = {
        name: 'Office',
        color: '#64748b',
      };

      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const inputB = {
        name: 'Travel',
        color: '#0f766e',
      };

      await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/expense-categories/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const categories = listResponse.body as ExpenseCategoryResponse[];

      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject(inputA);
      expect(categories[0].archivedAt).not.toBeNull();
      expect(categories.some((category) => category.name === inputB.name)).toBe(
        false,
      );
    });

    it('lists the most recently archived categories first', async () => {
      const createResponseA = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const categoryA = createResponseA.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${categoryA.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await prisma.expenseCategory.update({
        where: { id: categoryA.id },
        data: { archivedAt: new Date('2026-01-01T00:00:00.000Z') },
      });

      const createResponseB = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Travel',
          color: '#0f766e',
        })
        .expect(HttpStatus.CREATED);

      const categoryB = createResponseB.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${categoryB.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await prisma.expenseCategory.update({
        where: { id: categoryB.id },
        data: { archivedAt: new Date('2026-01-02T00:00:00.000Z') },
      });

      const listResponse = await request(http)
        .get('/expense-categories/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const categories = listResponse.body as ExpenseCategoryResponse[];

      expect(categories.map(({ id }) => id)).toEqual([
        categoryB.id,
        categoryA.id,
      ]);
    });
  });

  describe('POST /expense-categories', () => {
    it('creates an expense category and returns it from GET /expense-categories', async () => {
      const input = {
        name: 'Office',
        color: '#64748b',
      };

      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      expect(createdCategory).toMatchObject({
        ...input,
        archivedAt: null,
      });
      expect(typeof createdCategory.id).toBe('string');
      expect(createdCategory.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(createdCategory.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(createdCategory.updatedAt))).toBe(false);

      const listResponse = await request(http)
        .get('/expense-categories')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const categories = listResponse.body as ExpenseCategoryResponse[];

      expect(categories).toHaveLength(1);
      expect(categories[0]).toMatchObject({
        id: createdCategory.id,
        ...input,
        archivedAt: null,
      });
    });

    it('rejects expense category creation with invalid payload and returns 400', async () => {
      const response = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          color: '#64748b',
        })
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');

      const nameError = error.errors?.find(
        (validationError) => validationError.field === 'name',
      );

      expect(nameError).toBeDefined();
      if (!nameError) {
        throw new Error('Expected validation error for "name"');
      }

      expect(typeof nameError.constraints.isString).toBe('string');
      expect(typeof nameError.constraints.isNotEmpty).toBe('string');

      const listResponse = await request(http)
        .get('/expense-categories')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(listResponse.body).toHaveLength(0);
    });

    it('rejects expense category creation with invalid color and returns 400', async () => {
      const response = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: 'blue',
        })
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');

      const colorError = error.errors?.find(
        (validationError) => validationError.field === 'color',
      );

      expect(colorError).toBeDefined();
      if (!colorError) {
        throw new Error('Expected validation error for "color"');
      }

      expect(typeof colorError.constraints.isHexColor).toBe('string');
    });

    it('rejects duplicate category name and returns 409', async () => {
      await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#0f766e',
        })
        .expect(HttpStatus.CONFLICT);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual([
        {
          field: 'name',
          constraints: {
            isUnique: 'A expense category with this name already exists',
          },
        },
      ]);
    });
  });

  describe('PATCH /expense-categories/:id', () => {
    it('updates an existing expense category', async () => {
      const createInput = {
        name: 'Office',
        color: '#64748b',
      };

      const updateInput = {
        name: 'Travel',
        color: '#0f766e',
      };

      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send(createInput)
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      const updateResponse = await request(http)
        .patch(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .send(updateInput)
        .expect(HttpStatus.OK);

      expect(updateResponse.body).toMatchObject({
        id: createdCategory.id,
        ...updateInput,
        archivedAt: null,
      });

      const getResponse = await request(http)
        .get(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(getResponse.body).toMatchObject({
        id: createdCategory.id,
        ...updateInput,
        archivedAt: null,
      });
    });

    it('returns 400 when the request body is empty', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      const response = await request(http)
        .patch(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      expect(error.errors?.[0]).toEqual({
        field: 'body',
        constraints: {
          isNotEmpty: 'Update body cannot be empty',
        },
      });
    });

    it('returns 400 when the category ID is not a valid UUID', async () => {
      const response = await request(http)
        .patch('/expense-categories/not-a-uuid')
        .set(authHeaders)
        .send({
          name: 'Travel',
          color: '#0f766e',
        })
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the category does not exist', async () => {
      const response = await request(http)
        .patch(`/expense-categories/${randomUUID()}`)
        .set(authHeaders)
        .send({
          name: 'Travel',
          color: '#0f766e',
        })
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });

    it('returns 409 when category name is already in use', async () => {
      const createResponseA = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const categoryA = createResponseA.body as ExpenseCategoryResponse;

      await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Travel',
          color: '#0f766e',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .patch(`/expense-categories/${categoryA.id}`)
        .set(authHeaders)
        .send({
          name: 'Travel',
        })
        .expect(HttpStatus.CONFLICT);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual([
        {
          field: 'name',
          constraints: {
            isUnique: 'A expense category with this name already exists',
          },
        },
      ]);
    });
  });

  describe('PATCH /expense-categories/:id/archive', () => {
    it('archives an active expense category', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const archivedResponse = await request(http)
        .get('/expense-categories/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const archivedCategories =
        archivedResponse.body as ExpenseCategoryResponse[];

      expect(archivedCategories[0].id).toBe(createdCategory.id);
      expect(archivedCategories[0].archivedAt).not.toBeNull();
    });

    it('returns 400 when the category ID is not a valid UUID', async () => {
      const response = await request(http)
        .patch('/expense-categories/not-a-uuid/archive')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the category does not exist', async () => {
      const response = await request(http)
        .patch(`/expense-categories/${randomUUID()}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });

    it('returns 409 when the category is already archived', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toEqual({
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
    });
  });

  describe('PATCH /expense-categories/:id/restore', () => {
    it('restores an archived expense category', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: createdCategory.id,
        name: 'Office',
        color: '#64748b',
        archivedAt: null,
      });
    });

    it('returns 400 when the category ID is not a valid UUID', async () => {
      const response = await request(http)
        .patch('/expense-categories/not-a-uuid/restore')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the category does not exist', async () => {
      const response = await request(http)
        .patch(`/expense-categories/${randomUUID()}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });

    it('returns 409 when the category is already active', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      const response = await request(http)
        .patch(`/expense-categories/${createdCategory.id}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toEqual({
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
    });
  });

  describe('DELETE /expense-categories/:id', () => {
    it('deletes an archived expense category', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      await request(http)
        .patch(`/expense-categories/${createdCategory.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await request(http)
        .delete(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NO_CONTENT);

      const deletedCategory = await prisma.expenseCategory.findUnique({
        where: { id: createdCategory.id },
      });

      expect(deletedCategory).toBeNull();
    });

    it('returns 404 when the category does not exist', async () => {
      const response = await request(http)
        .delete(`/expense-categories/${randomUUID()}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });

    it('returns 409 when the category is still active', async () => {
      const createResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const createdCategory = createResponse.body as ExpenseCategoryResponse;

      const response = await request(http)
        .delete(`/expense-categories/${createdCategory.id}`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toMatchObject({
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
    });

    it('returns 400 when the category ID is not a valid UUID', async () => {
      const response = await request(http)
        .delete('/expense-categories/not-a-uuid')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 409 when the category is still linked to expenses', async () => {
      const createVendorResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send({
          name: 'Atlas Office Supplies',
          email: 'contact@atlasoffice.com',
          phone: '+212600000001',
          website: 'https://atlasoffice.com',
          notes: 'Office supplies vendor',
        })
        .expect(HttpStatus.CREATED);

      const vendor = createVendorResponse.body as { id: string };

      const createCategoryResponse = await request(http)
        .post('/expense-categories')
        .set(authHeaders)
        .send({
          name: 'Office',
          color: '#64748b',
        })
        .expect(HttpStatus.CREATED);

      const category = createCategoryResponse.body as ExpenseCategoryResponse;

      await prisma.expense.create({
        data: {
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies purchase',
          amount: '1250.50',
          expenseDate: new Date('2026-01-15T00:00:00.000Z'),
          notes: 'Monthly stationery and printer supplies',
        },
      });

      await request(http)
        .patch(`/expense-categories/${category.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .delete(`/expense-categories/${category.id}`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toMatchObject({
        message: 'Expense category cannot be deleted because it has expenses',
      });

      const persistedCategory = await prisma.expenseCategory.findUnique({
        where: { id: category.id },
      });

      expect(persistedCategory).toMatchObject({
        id: category.id,
        name: 'Office',
        color: '#64748b',
      });
      expect(persistedCategory?.archivedAt).not.toBeNull();

      const persistedExpense = await prisma.expense.findFirst({
        where: { categoryId: category.id },
      });

      expect(persistedExpense).not.toBeNull();
    });
  });
});
