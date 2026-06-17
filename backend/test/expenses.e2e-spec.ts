import request from 'supertest';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';

type ExpenseResponse = {
  id: string;
  vendorId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  expenseDate: string;
  notes: string | null;
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

describe('Expenses e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createVendor() {
    const response = await request(http)
      .post('/vendors')
      .send({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      })
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createCategory() {
    const response = await request(http)
      .post('/expense-categories')
      .send({
        name: 'Office',
        color: '#64748b',
      })
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  describe('GET /expenses', () => {
    it('returns empty list initially', async () => {
      const response = await request(http)
        .get('/expenses')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });

    it('returns active expenses only', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponseA = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const expenseA = createResponseA.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${expenseA.id}/archive`)
        .expect(HttpStatus.OK);

      await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/expenses')
        .expect(HttpStatus.OK);

      const expenses = listResponse.body as ExpenseResponse[];

      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        description: 'Taxi',
        archivedAt: null,
      });
    });

    it('lists the most recent expenseDate first', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponseA = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const expenseA = createResponseA.body as ExpenseResponse;

      const createResponseB = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const expenseB = createResponseB.body as ExpenseResponse;

      const listResponse = await request(http)
        .get('/expenses')
        .expect(HttpStatus.OK);

      const expenses = listResponse.body as ExpenseResponse[];

      expect(expenses.map(({ id }) => id)).toEqual([expenseB.id, expenseA.id]);
    });
  });

  describe('GET /expenses/:id', () => {
    it('returns the expense when it exists and is active', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      const response = await request(http)
        .get(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.OK);

      const expense = response.body as ExpenseResponse;

      expect(expense).toMatchObject({
        id: createdExpense.id,
        vendorId: vendor.id,
        categoryId: category.id,
        description: 'Office supplies',
        amount: '1250.5',
        notes: 'Monthly stationery',
        archivedAt: null,
      });
    });

    it('returns 400 when the expense ID is not a valid UUID', async () => {
      const response = await request(http)
        .get('/expenses/not-a-uuid')
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the expense does not exist', async () => {
      const response = await request(http)
        .get(`/expenses/${randomUUID()}`)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });

    it('returns 404 when the expense is archived', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${createdExpense.id}/archive`)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });
  });

  describe('GET /expenses/archived', () => {
    it('returns an empty array when no archived expenses exist', async () => {
      const response = await request(http)
        .get('/expenses/archived')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual([]);
    });

    it('returns archived expenses only', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponseA = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const expenseA = createResponseA.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${expenseA.id}/archive`)
        .expect(HttpStatus.OK);

      await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/expenses/archived')
        .expect(HttpStatus.OK);

      const expenses = listResponse.body as ExpenseResponse[];

      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        id: expenseA.id,
        description: 'Office supplies',
      });
      expect(expenses[0].archivedAt).not.toBeNull();
    });
  });

  describe('POST /expenses', () => {
    it('creates an expense and returns it from GET /expenses', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const input = {
        vendorId: vendor.id,
        categoryId: category.id,
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-01-15T00:00:00.000Z',
        notes: 'Monthly stationery',
      };

      const createResponse = await request(http)
        .post('/expenses')
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      expect(createdExpense).toMatchObject({
        vendorId: input.vendorId,
        categoryId: input.categoryId,
        description: input.description,
        amount: '1250.5',
        notes: input.notes,
        archivedAt: null,
      });
      expect(typeof createdExpense.id).toBe('string');
      expect(createdExpense.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(createdExpense.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(createdExpense.updatedAt))).toBe(false);

      const listResponse = await request(http)
        .get('/expenses')
        .expect(HttpStatus.OK);

      const expenses = listResponse.body as ExpenseResponse[];

      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        id: createdExpense.id,
        description: input.description,
      });
    });

    it('creates an expense without category', async () => {
      const vendor = await createVendor();

      const response = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const expense = response.body as ExpenseResponse;

      expect(expense.categoryId).toBeNull();
      expect(expense.description).toBe('Taxi');
    });

    it('rejects expense creation with invalid payload and returns 400', async () => {
      const response = await request(http)
        .post('/expenses')
        .send({
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
        })
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');

      const vendorIdError = error.errors?.find(
        (validationError) => validationError.field === 'vendorId',
      );

      expect(vendorIdError).toBeDefined();
      if (!vendorIdError) {
        throw new Error('Expected validation error for "vendorId"');
      }

      expect(typeof vendorIdError.constraints.isUuid).toBe('string');
    });

    it('returns 404 when vendor does not exist', async () => {
      const category = await createCategory();

      const response = await request(http)
        .post('/expenses')
        .send({
          vendorId: randomUUID(),
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });

    it('returns 404 when category does not exist', async () => {
      const vendor = await createVendor();

      const response = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: randomUUID(),
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense category not found');
    });
  });

  describe('PATCH /expenses/:id', () => {
    it('updates an existing expense', async () => {
      const vendor = await createVendor();
      const category = await createCategory();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          categoryId: category.id,
          description: 'Office supplies',
          amount: 1250.5,
          expenseDate: '2026-01-15T00:00:00.000Z',
          notes: 'Monthly stationery',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      const updateResponse = await request(http)
        .patch(`/expenses/${createdExpense.id}`)
        .send({
          description: 'Office supplies and toner',
          amount: 1400.75,
          expenseDate: '2026-01-16T00:00:00.000Z',
        })
        .expect(HttpStatus.OK);

      expect(updateResponse.body).toMatchObject({
        id: createdExpense.id,
        description: 'Office supplies and toner',
        amount: '1400.75',
      });

      const getResponse = await request(http)
        .get(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.OK);

      expect(getResponse.body).toMatchObject({
        id: createdExpense.id,
        description: 'Office supplies and toner',
        amount: '1400.75',
      });
    });

    it('returns 400 when the request body is empty', async () => {
      const vendor = await createVendor();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      const response = await request(http)
        .patch(`/expenses/${createdExpense.id}`)
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

    it('returns 404 when the expense does not exist', async () => {
      const response = await request(http)
        .patch(`/expenses/${randomUUID()}`)
        .send({
          description: 'Updated description',
        })
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });
  });

  describe('PATCH /expenses/:id/archive', () => {
    it('archives an active expense', async () => {
      const vendor = await createVendor();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${createdExpense.id}/archive`)
        .expect(HttpStatus.OK);

      const archivedResponse = await request(http)
        .get('/expenses/archived')
        .expect(HttpStatus.OK);

      const archivedExpenses = archivedResponse.body as ExpenseResponse[];

      expect(archivedExpenses[0].id).toBe(createdExpense.id);
      expect(archivedExpenses[0].archivedAt).not.toBeNull();
    });
  });

  describe('PATCH /expenses/:id/restore', () => {
    it('restores an archived expense', async () => {
      const vendor = await createVendor();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${createdExpense.id}/archive`)
        .expect(HttpStatus.OK);

      await request(http)
        .patch(`/expenses/${createdExpense.id}/restore`)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        id: createdExpense.id,
        archivedAt: null,
      });
    });
  });

  describe('DELETE /expenses/:id', () => {
    it('deletes an archived expense', async () => {
      const vendor = await createVendor();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      await request(http)
        .patch(`/expenses/${createdExpense.id}/archive`)
        .expect(HttpStatus.OK);

      await request(http)
        .delete(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.NO_CONTENT);

      const deletedExpense = await prisma.expense.findUnique({
        where: { id: createdExpense.id },
      });

      expect(deletedExpense).toBeNull();
    });

    it('returns 409 when the expense is still active', async () => {
      const vendor = await createVendor();

      const createResponse = await request(http)
        .post('/expenses')
        .send({
          vendorId: vendor.id,
          description: 'Taxi',
          amount: 220.0,
          expenseDate: '2026-01-16T00:00:00.000Z',
          notes: 'Airport transfer',
        })
        .expect(HttpStatus.CREATED);

      const createdExpense = createResponse.body as ExpenseResponse;

      const response = await request(http)
        .delete(`/expenses/${createdExpense.id}`)
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toMatchObject({
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
    });
  });
});
