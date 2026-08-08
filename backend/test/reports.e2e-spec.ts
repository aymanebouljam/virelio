import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import type {
  CategoryComparison,
  ExpenseReport,
  ReportInsights,
} from '../src/reports/reports.service';
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

  describe('GET /reports/insights', () => {
    it('requires authentication', async () => {
      await request(http)
        .get('/reports/insights')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('returns date-filtered monthly and vendor spending totals', async () => {
      const atlas = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });
      const transport = await createVendor({
        name: 'City Transport',
        email: 'contact@citytransport.com',
        phone: '+212600000002',
        website: 'https://citytransport.com',
        notes: 'Transport vendor',
      });

      await createExpense({
        vendorId: atlas.id,
        description: 'Excluded equipment',
        amount: 1000,
        expenseDate: '2026-04-30',
      });
      await createExpense({
        vendorId: atlas.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-05-20',
      });
      await createExpense({
        vendorId: atlas.id,
        description: 'Notebooks',
        amount: 50,
        expenseDate: '2026-06-10',
      });
      await createExpense({
        vendorId: transport.id,
        description: 'Airport transfer',
        amount: 220,
        expenseDate: '2026-06-21',
      });

      const response = await request(http)
        .get('/reports/insights')
        .set(authHeaders)
        .query({ dateFrom: '2026-05-01', dateTo: '2026-06-30' })
        .expect(HttpStatus.OK);
      const insights = response.body as ReportInsights;

      expect(insights.monthlyTotals).toEqual([
        { month: '2026-05', totalAmount: '80.50', expenseCount: 1 },
        { month: '2026-06', totalAmount: '270.00', expenseCount: 2 },
      ]);
      expect(insights.vendorTotals).toEqual([
        {
          vendorId: transport.id,
          vendorName: 'City Transport',
          totalAmount: '220.00',
          expenseCount: 1,
        },
        {
          vendorId: atlas.id,
          vendorName: 'Atlas Office Supplies',
          totalAmount: '130.50',
          expenseCount: 2,
        },
      ]);
    });
  });

  describe('GET /reports/expenses.csv', () => {
    it('requires authentication', async () => {
      await request(http)
        .get('/reports/expenses.csv')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('downloads expenses from the selected date range', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });

      await createExpense({
        vendorId: vendor.id,
        description: 'Excluded equipment',
        amount: 1000,
        expenseDate: '2026-05-31',
      });
      await createExpense({
        vendorId: vendor.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-06-21',
        notes: 'Office restock',
      });

      const response = await request(http)
        .get('/reports/expenses.csv')
        .set(authHeaders)
        .query({ dateFrom: '2026-06-01', dateTo: '2026-06-30' })
        .expect(HttpStatus.OK)
        .expect('Content-Type', /text\/csv/)
        .expect(
          'Content-Disposition',
          'attachment; filename="virelio-expenses.csv"',
        );

      expect(response.text).toContain(
        '"2026-06-21","Printer paper","Atlas Office Supplies","Uncategorized","80.50","USD","Office restock"',
      );
      expect(response.text).not.toContain('Excluded equipment');
    });
  });

  describe('GET /reports/category-comparison', () => {
    it('requires authentication', async () => {
      await request(http)
        .get('/reports/category-comparison')
        .query({ dateFrom: '2026-06-01', dateTo: '2026-06-30' })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('requires both comparison dates', async () => {
      const response = await request(http)
        .get('/reports/category-comparison')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);
      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'dateFrom' }),
          expect.objectContaining({ field: 'dateTo' }),
        ]),
      );
    });

    it('compares category totals with the preceding equal-length period', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });
      const travel = await createCategory({
        name: 'Travel',
        color: '#0f766e',
      });
      const meals = await createCategory({
        name: 'Meals',
        color: '#ea580c',
      });

      await createExpense({
        vendorId: vendor.id,
        categoryId: travel.id,
        description: 'Excluded previous expense',
        amount: 999,
        expenseDate: '2026-05-01',
      });
      await createExpense({
        vendorId: vendor.id,
        categoryId: travel.id,
        description: 'Previous travel',
        amount: 200,
        expenseDate: '2026-05-10',
      });
      await createExpense({
        vendorId: vendor.id,
        description: 'Previous uncategorized',
        amount: 50,
        expenseDate: '2026-05-20',
      });
      await createExpense({
        vendorId: vendor.id,
        categoryId: travel.id,
        description: 'Current travel',
        amount: 400,
        expenseDate: '2026-06-10',
      });
      await createExpense({
        vendorId: vendor.id,
        categoryId: meals.id,
        description: 'Current meals',
        amount: 100,
        expenseDate: '2026-06-20',
      });

      const response = await request(http)
        .get('/reports/category-comparison')
        .set(authHeaders)
        .query({ dateFrom: '2026-06-01', dateTo: '2026-06-30' })
        .expect(HttpStatus.OK);
      const comparison = response.body as CategoryComparison;

      expect(comparison).toEqual({
        currentPeriod: {
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
          totalAmount: '500.00',
          expenseCount: 2,
        },
        previousPeriod: {
          dateFrom: '2026-05-02',
          dateTo: '2026-05-31',
          totalAmount: '250.00',
          expenseCount: 2,
        },
        categories: [
          {
            categoryId: travel.id,
            categoryName: 'Travel',
            currentAmount: '400.00',
            previousAmount: '200.00',
            changeAmount: '200.00',
            changePercentage: 100,
          },
          {
            categoryId: meals.id,
            categoryName: 'Meals',
            currentAmount: '100.00',
            previousAmount: '0.00',
            changeAmount: '100.00',
            changePercentage: null,
          },
          {
            categoryId: null,
            categoryName: 'Uncategorized',
            currentAmount: '0.00',
            previousAmount: '50.00',
            changeAmount: '-50.00',
            changePercentage: -100,
          },
        ],
      });
    });
  });
});
