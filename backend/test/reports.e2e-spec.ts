import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import type { ExpenseReport } from '../src/reports/reports.service';
import { rm } from 'node:fs/promises';
import { getUploadsRoot } from '../src/proofs/proofs-paths';
import { createAuth } from './test-auth';

type ErrorResponse = {
  message: string;
  errors: Array<{ field: string }>;
};

describe('Reports e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await rm(getUploadsRoot(), { recursive: true, force: true });
    ({ authHeaders } = await createAuth(http));
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await rm(getUploadsRoot(), { recursive: true, force: true });
    await app?.close();
  });

  async function createVendor(input: {
    name: string;
    email: string;
    phone: string;
    website: string;
    notes: string;
  }) {
    const response = await request(http)
      .post('/vendors')
      .set(authHeaders)
      .send(input)
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createCategory(input: { name: string; color: string }) {
    const response = await request(http)
      .post('/expense-categories')
      .set(authHeaders)
      .send(input)
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createExpense(input: {
    vendorId: string;
    categoryId?: string;
    description: string;
    amount: number;
    expenseDate: string;
    notes?: string;
  }) {
    const response = await request(http)
      .post('/expenses')
      .set(authHeaders)
      .send(input)
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  describe('GET /reports/expenses', () => {
    it('returns an empty expense report initially', async () => {
      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        totalAmount: '0.00',
        expenseCount: 0,
        categoryTotals: [],
        expenses: {
          items: [],
          pagination: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
          },
        },
      });
    });

    it('returns grouped expense report data', async () => {
      const vendorOne = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });

      const vendorTwo = await createVendor({
        name: 'City Transport',
        email: 'contact@citytransport.com',
        phone: '+212600000002',
        website: 'https://citytransport.com',
        notes: 'Transport vendor',
      });

      const category = await createCategory({
        name: 'Travel',
        color: '#0f766e',
      });

      await createExpense({
        vendorId: vendorTwo.id,
        categoryId: category.id,
        description: 'Airport transfer',
        amount: 220,
        expenseDate: '2026-06-21',
        notes: 'Client pickup',
      });

      await createExpense({
        vendorId: vendorOne.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-06-20',
        notes: 'Office restock',
      });

      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const report = response.body as ExpenseReport;
      expect(report).toMatchObject({
        totalAmount: '300.50',
        expenseCount: 2,
      });

      expect(report.categoryTotals).toEqual([
        {
          categoryId: category.id,
          categoryName: 'Travel',
          totalAmount: '220.00',
          expenseCount: 1,
        },
        {
          categoryId: null,
          categoryName: 'Uncategorized',
          totalAmount: '80.50',
          expenseCount: 1,
        },
      ]);

      expect(report.expenses.pagination).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 2,
        totalPages: 1,
      });
      expect(report.expenses.items).toHaveLength(2);
      expect(report.expenses.items[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
        vendorId: vendorTwo.id,
        vendorName: 'City Transport',
        categoryId: category.id,
        categoryName: 'Travel',
        notes: 'Client pickup',
      });
      expect(report.expenses.items[1]).toMatchObject({
        description: 'Printer paper',
        amount: '80.50',
        vendorId: vendorOne.id,
        vendorName: 'Atlas Office Supplies',
        categoryId: null,
        categoryName: 'Uncategorized',
        notes: 'Office restock',
      });
    });

    it('filters the expense report by date range', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });

      const category = await createCategory({
        name: 'Travel',
        color: '#0f766e',
      });

      await createExpense({
        vendorId: vendor.id,
        categoryId: category.id,
        description: 'Airport transfer',
        amount: 220,
        expenseDate: '2026-06-21',
        notes: 'Client pickup',
      });

      await createExpense({
        vendorId: vendor.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-06-10',
        notes: 'Office restock',
      });

      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .query({
          dateFrom: '2026-06-20',
          dateTo: '2026-06-21',
        })
        .expect(HttpStatus.OK);

      const report = response.body as ExpenseReport;
      expect(report).toMatchObject({
        totalAmount: '220.00',
        expenseCount: 1,
      });

      expect(report.categoryTotals).toEqual([
        {
          categoryId: category.id,
          categoryName: 'Travel',
          totalAmount: '220.00',
          expenseCount: 1,
        },
      ]);

      expect(report.expenses.items).toHaveLength(1);
      expect(report.expenses.items[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
      });
    });

    it('paginates expense rows without changing full report totals', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });

      for (let index = 1; index <= 3; index += 1) {
        await createExpense({
          vendorId: vendor.id,
          description: `Expense ${index}`,
          amount: index * 100,
          expenseDate: `2026-06-${(20 + index).toString()}`,
        });
      }

      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .query({ page: 2, pageSize: 2 })
        .expect(HttpStatus.OK);
      const report = response.body as ExpenseReport;

      expect(report).toMatchObject({
        totalAmount: '600.00',
        expenseCount: 3,
        categoryTotals: [
          {
            categoryId: null,
            categoryName: 'Uncategorized',
            totalAmount: '600.00',
            expenseCount: 3,
          },
        ],
      });
      expect(report.expenses.pagination).toEqual({
        page: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
      });
      expect(report.expenses.items).toHaveLength(1);
      expect(report.expenses.items[0]).toMatchObject({
        description: 'Expense 1',
        amount: '100.00',
      });
    });

    it('returns 400 when dateFrom is after dateTo', async () => {
      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .query({
          dateFrom: '2026-06-22',
          dateTo: '2026-06-21',
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toEqual({
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
    });

    it.each([
      ['page', '0'],
      ['page', '1.5'],
      ['pageSize', '0'],
      ['pageSize', '101'],
    ])('returns 400 for invalid %s = %s', async (field, value) => {
      const response = await request(http)
        .get('/reports/expenses')
        .set(authHeaders)
        .query({ [field]: value })
        .expect(HttpStatus.BAD_REQUEST);
      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })]),
      );
    });
  });
});
