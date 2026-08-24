import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import { DashboardSummary } from '../src/dashboard/dashboard.service';
import { getUploadsRoot } from '../src/proofs/proofs-paths';
import { rm } from 'node:fs/promises';
import { createAuth } from './test-auth';

describe('Dashboard e2e', () => {
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

  async function uploadProof(expenseId: string, filename = 'receipt.jpg') {
    const jpegContent = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.from('receipt content'),
    ]);
    const response = await request(http)
      .post(`/expenses/${expenseId}/proofs`)
      .set(authHeaders)
      .attach('file', jpegContent, filename)
      .expect(HttpStatus.CREATED);

    return response.body as {
      id: string;
      expenseId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
    };
  }

  describe('GET /dashboard/summary', () => {
    it('returns an empty summary initially', async () => {
      const response = await request(http)
        .get('/dashboard/summary')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        totalSpend: '0.00',
        activeVendors: 0,
        uncategorizedExpenses: 0,
        proofDocuments: 0,
        missingProofExpenses: 0,
        dueRecurringExpenses: 0,
        recentExpenses: [],
        recentProofs: [],
        recentActivity: [],
        categoryBreakdown: [],
      });
    });

    it('returns summary aggregates for active records', async () => {
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
        .get('/dashboard/summary')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const summary = response.body as DashboardSummary;

      expect(summary).toMatchObject({
        totalSpend: '300.50',
        activeVendors: 2,
        uncategorizedExpenses: 1,
        proofDocuments: 0,
      });

      expect(summary.recentExpenses).toHaveLength(2);
      expect(summary.recentExpenses[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
        vendorId: vendorTwo.id,
        vendorName: 'City Transport',
        categoryName: 'Travel',
      });
      expect(summary.recentExpenses[1]).toMatchObject({
        description: 'Printer paper',
        amount: '80.50',
        vendorId: vendorOne.id,
        vendorName: 'Atlas Office Supplies',
        categoryName: 'Uncategorized',
      });

      expect(summary.recentProofs).toEqual([]);

      expect(summary.recentActivity.length).toBeGreaterThan(0);
      expect(summary.recentActivity[0]).toMatchObject({
        type: 'expense',
        title: 'Airport transfer',
        subtitle: 'City Transport · Travel',
      });

      expect(typeof summary.recentActivity[0].expenseId).toBe('string');

      expect(summary.recentActivity[1]).toMatchObject({
        type: 'expense',
        title: 'Printer paper',
        subtitle: 'Atlas Office Supplies · Uncategorized',
      });

      expect(typeof summary.recentActivity[0].expenseId).toBe('string');

      expect(summary.categoryBreakdown).toEqual([
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
    });

    it('returns the five highest-spend categories and groups the rest as Other', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });
      const categories: Array<{ id: string }> = [];

      for (let index = 0; index < 7; index += 1) {
        const category = await createCategory({
          name: `Category ${index + 1}`,
          color: '#0f766e',
        });
        categories.push(category);

        await createExpense({
          vendorId: vendor.id,
          categoryId: category.id,
          description: `Expense ${index + 1}`,
          amount: 700 - index * 100,
          expenseDate: `2026-06-${(index + 1).toString().padStart(2, '0')}`,
        });
      }

      const response = await request(http)
        .get('/dashboard/summary')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const summary = response.body as DashboardSummary;
      const leadingCategories = categories
        .slice(0, 5)
        .map((category, index) => ({
          categoryId: category.id,
          categoryName: `Category ${index + 1}`,
          totalAmount: `${700 - index * 100}.00`,
          expenseCount: 1,
        }));

      expect(summary.categoryBreakdown).toEqual([
        ...leadingCategories,
        {
          categoryId: null,
          categoryName: 'Other',
          totalAmount: '300.00',
          expenseCount: 2,
        },
      ]);
    });

    it('returns recent proof uploads for active expenses only', async () => {
      const vendor = await createVendor({
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      });

      const activeExpense = await createExpense({
        vendorId: vendor.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-06-20',
        notes: 'Office restock',
      });

      const archivedExpense = await createExpense({
        vendorId: vendor.id,
        description: 'Old archived expense',
        amount: 45,
        expenseDate: '2026-06-19',
        notes: 'Archive me',
      });

      const activeProof = await uploadProof(
        activeExpense.id,
        'active-receipt.jpg',
      );
      await uploadProof(archivedExpense.id, 'archived-receipt.jpg');

      await request(http)
        .patch(`/expenses/${archivedExpense.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get('/dashboard/summary')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const summary = response.body as DashboardSummary;

      expect(summary.proofDocuments).toBe(1);

      expect(summary.recentProofs).toHaveLength(1);
      expect(summary.recentProofs[0]).toMatchObject({
        id: activeProof.id,
        originalName: 'active-receipt.jpg',
        expenseId: activeExpense.id,
        expenseDescription: 'Printer paper',
      });

      expect(summary.recentProofs[0]).not.toHaveProperty('storagePath');

      expect(summary.recentActivity).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'proof',
            title: 'active-receipt.jpg',
            subtitle: 'Printer paper',
            expenseId: activeExpense.id,
          }),
        ]),
      );
    });

    it('filters dashboard summary by date range query params', async () => {
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

      const inRangeExpense = await createExpense({
        vendorId: vendor.id,
        categoryId: category.id,
        description: 'Airport transfer',
        amount: 220,
        expenseDate: '2026-06-21',
        notes: 'Client pickup',
      });

      const outOfRangeExpense = await createExpense({
        vendorId: vendor.id,
        description: 'Printer paper',
        amount: 80.5,
        expenseDate: '2026-06-10',
        notes: 'Office restock',
      });

      await uploadProof(inRangeExpense.id, 'in-range.jpg');
      await uploadProof(outOfRangeExpense.id, 'out-of-range.jpg');

      const response = await request(http)
        .get('/dashboard/summary')
        .set(authHeaders)
        .query({
          dateFrom: '2026-06-20',
          dateTo: '2026-06-21',
        })
        .expect(HttpStatus.OK);

      const summary = response.body as DashboardSummary;

      expect(summary).toMatchObject({
        totalSpend: '220.00',
        activeVendors: 1,
        uncategorizedExpenses: 1,
        proofDocuments: 0,
      });

      expect(summary.recentExpenses).toHaveLength(1);
      expect(summary.recentExpenses[0]).toMatchObject({
        description: 'Airport transfer',
        amount: '220.00',
        categoryName: 'Travel',
      });

      expect(summary.recentProofs).toHaveLength(0);

      expect(summary.categoryBreakdown).toEqual([
        {
          categoryId: category.id,
          categoryName: 'Travel',
          totalAmount: '220.00',
          expenseCount: 1,
        },
      ]);
    });

    it('returns 400 when dateFrom is after dateTo', async () => {
      const response = await request(http)
        .get('/dashboard/summary')
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
