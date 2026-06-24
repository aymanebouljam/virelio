import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import { DashboardSummary } from '../src/dashboard/dashboard.service';

describe('Dashboard e2e', () => {
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
    await resetDatabase(prisma);
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
      .send(input)
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createCategory(input: { name: string; color: string }) {
    const response = await request(http)
      .post('/expense-categories')
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
      .send(input)
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function uploadProof(expenseId: string, filename = 'receipt.jpg') {
    const response = await request(http)
      .post(`/expenses/${expenseId}/proofs`)
      .attach('file', Buffer.from('receipt content'), filename)
      .expect(HttpStatus.CREATED);

    return response.body as {
      id: string;
      expenseId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      storagePath: string;
      createdAt: string;
    };
  }

  describe('GET /dashboard/summary', () => {
    it('returns an empty summary initially', async () => {
      const response = await request(http)
        .get('/dashboard/summary')
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        totalSpend: '0.00',
        activeVendors: 0,
        uncategorizedExpenses: 0,
        proofDocuments: 0,
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
        .expect(HttpStatus.OK);

      const response = await request(http)
        .get('/dashboard/summary')
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

      expect(summary.recentProofs[0].storagePath).toMatch(
        new RegExp(`^uploads/proofs/${activeExpense.id}/[^/]+\\.jpg$`),
      );

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
  });
});
