import { HttpStatus, type INestApplication } from '@nestjs/common';
import { rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { getUploadsRoot } from '../src/proofs/proofs-paths';
import { createAuth } from './test-auth';
import { createTestApp, resetDatabase } from './test-app';
type ApiResponse = {
  status: number;
  body: {
    id: string;
  };
};
describe('Tenant ownership e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;
  let ownerHeaders: Record<string, string>;
  let otherUserHeaders: Record<string, string>;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await rm(getUploadsRoot(), { recursive: true, force: true });

    ({ authHeaders: ownerHeaders } = await createAuth(http));
    ({ authHeaders: otherUserHeaders } = await createAuth(http, {
      email: 'other-user@local.dev',
      fullName: 'Other User',
    }));
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await rm(getUploadsRoot(), { recursive: true, force: true });
    await app?.close();
  });

  async function createOwnerRecords() {
    const vendorResponse = (await request(http)
      .post('/vendors')
      .set(ownerHeaders)
      .send({ name: 'Owner Vendor' })
      .expect(HttpStatus.CREATED)) as ApiResponse;

    const categoryResponse = (await request(http)
      .post('/expense-categories')
      .set(ownerHeaders)
      .send({ name: 'Owner Category' })
      .expect(HttpStatus.CREATED)) as ApiResponse;

    const expenseResponse = (await request(http)
      .post('/expenses')
      .set(ownerHeaders)
      .send({
        vendorId: vendorResponse.body.id,
        categoryId: categoryResponse.body.id,
        description: 'Owner expense',
        amount: 125,
        expenseDate: '2026-07-01',
      })
      .expect(HttpStatus.CREATED)) as ApiResponse;

    return {
      vendorId: vendorResponse.body.id,
      categoryId: categoryResponse.body.id,
      expenseId: expenseResponse.body.id,
    };
  }

  it('allows vendor and category unique values to be reused by another user', async () => {
    const vendorInput = {
      name: 'Shared Vendor',
      email: 'shared@example.com',
      phone: '+212600000099',
      website: 'https://shared.example.com',
    };

    const categoryInput = {
      name: 'Shared Category',
      color: '#64748b',
    };

    const ownerVendor = (await request(http)
      .post('/vendors')
      .set(ownerHeaders)
      .send(vendorInput)
      .expect(HttpStatus.CREATED)) as ApiResponse;

    const otherUserVendor = (await request(http)
      .post('/vendors')
      .set(otherUserHeaders)
      .send(vendorInput)
      .expect(HttpStatus.CREATED)) as ApiResponse;

    const ownerCategory = (await request(http)
      .post('/expense-categories')
      .set(ownerHeaders)
      .send(categoryInput)
      .expect(HttpStatus.CREATED)) as ApiResponse;

    const otherUserCategory = (await request(http)
      .post('/expense-categories')
      .set(otherUserHeaders)
      .send(categoryInput)
      .expect(HttpStatus.CREATED)) as ApiResponse;

    expect(otherUserVendor.body.id).not.toBe(ownerVendor.body.id);
    expect(otherUserCategory.body.id).not.toBe(ownerCategory.body.id);
  });

  it('excludes another user records from list endpoints', async () => {
    await createOwnerRecords();

    const [vendors, categories, expenses] = await Promise.all([
      request(http).get('/vendors').set(otherUserHeaders).expect(HttpStatus.OK),
      request(http)
        .get('/expense-categories')
        .set(otherUserHeaders)
        .expect(HttpStatus.OK),
      request(http)
        .get('/expenses')
        .set(otherUserHeaders)
        .expect(HttpStatus.OK),
    ]);

    expect(vendors.body).toEqual([]);
    expect(categories.body).toEqual([]);
    expect(expenses.body).toEqual({
      items: [],
      pagination: {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 0,
      },
    });
  });

  it('returns 404 when another user reads, updates, or archives owned records', async () => {
    const { vendorId, categoryId, expenseId } = await createOwnerRecords();

    const requests = [
      () => request(http).get(`/vendors/${vendorId}`).set(otherUserHeaders),
      () =>
        request(http)
          .patch(`/vendors/${vendorId}`)
          .set(otherUserHeaders)
          .send({ name: 'Changed' }),
      () =>
        request(http)
          .patch(`/vendors/${vendorId}/archive`)
          .set(otherUserHeaders),

      () =>
        request(http)
          .get(`/expense-categories/${categoryId}`)
          .set(otherUserHeaders),
      () =>
        request(http)
          .patch(`/expense-categories/${categoryId}`)
          .set(otherUserHeaders)
          .send({ name: 'Changed' }),
      () =>
        request(http)
          .patch(`/expense-categories/${categoryId}/archive`)
          .set(otherUserHeaders),

      () => request(http).get(`/expenses/${expenseId}`).set(otherUserHeaders),
      () =>
        request(http)
          .patch(`/expenses/${expenseId}`)
          .set(otherUserHeaders)
          .send({ description: 'Changed' }),
      () =>
        request(http)
          .patch(`/expenses/${expenseId}/archive`)
          .set(otherUserHeaders),
    ];

    for (const sendRequest of requests) {
      await sendRequest().expect(HttpStatus.NOT_FOUND);
    }
  });

  it('does not let another user restore or delete archived owned records', async () => {
    const { vendorId, categoryId, expenseId } = await createOwnerRecords();

    await request(http)
      .patch(`/expenses/${expenseId}/archive`)
      .set(ownerHeaders)
      .expect(HttpStatus.OK);

    await request(http)
      .patch(`/expense-categories/${categoryId}/archive`)
      .set(ownerHeaders)
      .expect(HttpStatus.OK);

    await request(http)
      .patch(`/vendors/${vendorId}/archive`)
      .set(ownerHeaders)
      .expect(HttpStatus.OK);

    const requests = [
      () =>
        request(http)
          .patch(`/vendors/${vendorId}/restore`)
          .set(otherUserHeaders),
      () => request(http).delete(`/vendors/${vendorId}`).set(otherUserHeaders),

      () =>
        request(http)
          .patch(`/expense-categories/${categoryId}/restore`)
          .set(otherUserHeaders),
      () =>
        request(http)
          .delete(`/expense-categories/${categoryId}`)
          .set(otherUserHeaders),

      () =>
        request(http)
          .patch(`/expenses/${expenseId}/restore`)
          .set(otherUserHeaders),
      () =>
        request(http).delete(`/expenses/${expenseId}`).set(otherUserHeaders),
    ];

    for (const sendRequest of requests) {
      await sendRequest().expect(HttpStatus.NOT_FOUND);
    }
  });

  it('does not let another user create an expense with owned relations', async () => {
    const { vendorId, categoryId } = await createOwnerRecords();

    const otherVendorResponse = (await request(http)
      .post('/vendors')
      .set(otherUserHeaders)
      .send({ name: 'Other User Vendor' })
      .expect(HttpStatus.CREATED)) as ApiResponse;

    await request(http)
      .post('/expenses')
      .set(otherUserHeaders)
      .send({
        vendorId,
        description: 'Cross-user vendor expense',
        amount: 10,
        expenseDate: '2026-07-01',
      })
      .expect(HttpStatus.NOT_FOUND);

    await request(http)
      .post('/expenses')
      .set(otherUserHeaders)
      .send({
        vendorId: otherVendorResponse.body.id,
        categoryId,
        description: 'Cross-user category expense',
        amount: 10,
        expenseDate: '2026-07-01',
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('does not let another user upload or remove an owned proof', async () => {
    const { expenseId } = await createOwnerRecords();

    const proofResponse = (await request(http)
      .post(`/expenses/${expenseId}/proofs`)
      .set(ownerHeaders)
      .attach('file', Buffer.from('receipt'), 'receipt.txt')
      .expect(HttpStatus.CREATED)) as ApiResponse;

    await request(http)
      .post(`/expenses/${expenseId}/proofs`)
      .set(otherUserHeaders)
      .attach('file', Buffer.from('receipt'), 'other-receipt.txt')
      .expect(HttpStatus.NOT_FOUND);

    await request(http)
      .delete(`/expenses/${expenseId}/proofs/${proofResponse.body.id}`)
      .set(otherUserHeaders)
      .expect(HttpStatus.NOT_FOUND);

    expect(
      await prisma.proofDocument.count({
        where: { expenseId },
      }),
    ).toBe(1);

    expect(
      await prisma.proofDocument.findUniqueOrThrow({
        where: { id: proofResponse.body.id },
      }),
    ).toMatchObject({ expenseId });
  });

  it('returns dashboard and report aggregates only for the authenticated user', async () => {
    await createOwnerRecords();

    const [dashboardResponse, reportResponse] = await Promise.all([
      request(http)
        .get('/dashboard/summary')
        .set(otherUserHeaders)
        .expect(HttpStatus.OK),
      request(http)
        .get('/reports/expenses')
        .set(otherUserHeaders)
        .expect(HttpStatus.OK),
    ]);

    expect(dashboardResponse.body).toMatchObject({
      totalSpend: '0.00',
      activeVendors: 0,
      uncategorizedExpenses: 0,
      proofDocuments: 0,
      recentExpenses: [],
      recentProofs: [],
      recentActivity: [],
      categoryBreakdown: [],
    });

    expect(reportResponse.body).toEqual({
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
});
