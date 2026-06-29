import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import type { ExpenseReport } from '../src/reports/reports.service';
import { rm } from 'node:fs/promises';
import { getUploadsRoot } from '../src/proofs/proofs-paths';
import { createAuthHeader } from './test-auth';

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
    authHeaders = await createAuthHeader(http);
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
        expenses: [],
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

      expect(report.expenses).toHaveLength(2);
      expect(report.expenses[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
        vendorId: vendorTwo.id,
        vendorName: 'City Transport',
        categoryId: category.id,
        categoryName: 'Travel',
        notes: 'Client pickup',
      });
      expect(report.expenses[1]).toMatchObject({
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

      expect(report.expenses).toHaveLength(1);
      expect(report.expenses[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
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
  });
});
