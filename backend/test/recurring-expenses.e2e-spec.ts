import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import { createAuth } from './test-auth';

type RecurringExpenseTemplateResponse = {
  id: string;
  vendorId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  currency: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  nextDueDate: string;
  notes: string | null;
  archivedAt: string | null;
  vendor: { id: string; name: string };
  category: { id: string; name: string } | null;
};

type RecurringExpenseTemplatePage = {
  items: RecurringExpenseTemplateResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

type ExpenseResponse = {
  id: string;
  recurringExpenseTemplateId: string | null;
  description: string;
  amount: string;
  expenseDate: string;
};

type ErrorResponse = {
  message: string;
  errors?: Array<{ field: string }>;
};

describe('Recurring expenses e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ authHeaders } = await createAuth(http));
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app?.close();
  });

  async function createVendor(headers = authHeaders, name = 'Atlas Workspace') {
    const response = await request(http)
      .post('/vendors')
      .set(headers)
      .send({ name })
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createCategory(headers = authHeaders, name = 'Software') {
    const response = await request(http)
      .post('/expense-categories')
      .set(headers)
      .send({ name, color: '#2563eb' })
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }

  async function createTemplate(
    vendorId: string,
    categoryId: string | undefined,
    overrides: Partial<{
      description: string;
      amount: number;
      frequency: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      nextDueDate: string;
      notes: string;
    }> = {},
    headers = authHeaders,
  ) {
    const response = await request(http)
      .post('/recurring-expenses')
      .set(headers)
      .send({
        vendorId,
        categoryId,
        description: 'Workspace subscription',
        amount: 45.5,
        frequency: 'MONTHLY',
        nextDueDate: '2026-09-01',
        notes: 'Team plan',
        ...overrides,
      })
      .expect(HttpStatus.CREATED);

    return response.body as RecurringExpenseTemplateResponse;
  }

  it('requires authentication', async () => {
    await request(http)
      .get('/recurring-expenses')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('validates template input', async () => {
    const response = await request(http)
      .post('/recurring-expenses')
      .set(authHeaders)
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
    const error = response.body as ErrorResponse;

    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'vendorId' }),
        expect.objectContaining({ field: 'description' }),
        expect.objectContaining({ field: 'amount' }),
        expect.objectContaining({ field: 'frequency' }),
        expect.objectContaining({ field: 'nextDueDate' }),
      ]),
    );
  });

  it.each([
    ['page', '0'],
    ['page', '1.5'],
    ['pageSize', '0'],
    ['pageSize', '101'],
  ])('rejects invalid %s values', async (field, value) => {
    const response = await request(http)
      .get('/recurring-expenses')
      .set(authHeaders)
      .query({ [field]: value })
      .expect(HttpStatus.BAD_REQUEST);
    const error = response.body as ErrorResponse;

    expect(error.message).toBe('Validation failed');
    expect(error.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
  });

  it('returns active templates with six-item pagination ordered by due date', async () => {
    const vendor = await createVendor();

    for (let day = 7; day >= 1; day -= 1) {
      await createTemplate(vendor.id, undefined, {
        description: `Template ${day}`,
        nextDueDate: `2026-09-0${day}`,
      });
    }

    const firstResponse = await request(http)
      .get('/recurring-expenses')
      .set(authHeaders)
      .expect(HttpStatus.OK);
    const firstPage = firstResponse.body as RecurringExpenseTemplatePage;

    expect(firstPage.items.map((template) => template.description)).toEqual([
      'Template 1',
      'Template 2',
      'Template 3',
      'Template 4',
      'Template 5',
      'Template 6',
    ]);
    expect(firstPage.pagination).toEqual({
      page: 1,
      pageSize: 6,
      totalItems: 7,
      totalPages: 2,
    });

    const secondResponse = await request(http)
      .get('/recurring-expenses')
      .set(authHeaders)
      .query({ page: 2, pageSize: 6 })
      .expect(HttpStatus.OK);
    const secondPage = secondResponse.body as RecurringExpenseTemplatePage;

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.description).toBe('Template 7');
  });

  it('supports the complete template lifecycle', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const created = await createTemplate(vendor.id, category.id);

    expect(created).toMatchObject({
      vendorId: vendor.id,
      categoryId: category.id,
      description: 'Workspace subscription',
      amount: '45.5',
      frequency: 'MONTHLY',
      notes: 'Team plan',
      archivedAt: null,
      vendor: { id: vendor.id, name: 'Atlas Workspace' },
      category: { id: category.id, name: 'Software' },
    });

    const detailResponse = await request(http)
      .get(`/recurring-expenses/${created.id}`)
      .set(authHeaders)
      .expect(HttpStatus.OK);
    expect(detailResponse.body).toMatchObject({ id: created.id });

    const updateResponse = await request(http)
      .patch(`/recurring-expenses/${created.id}`)
      .set(authHeaders)
      .send({
        description: 'Annual workspace subscription',
        categoryId: null,
        frequency: 'YEARLY',
        nextDueDate: '2027-01-15',
        notes: null,
      })
      .expect(HttpStatus.OK);
    expect(updateResponse.body).toMatchObject({
      description: 'Annual workspace subscription',
      categoryId: null,
      category: null,
      frequency: 'YEARLY',
      notes: null,
    });

    await request(http)
      .patch(`/recurring-expenses/${created.id}/archive`)
      .set(authHeaders)
      .expect(HttpStatus.OK);
    const archivedResponse = await request(http)
      .get('/recurring-expenses/archived')
      .set(authHeaders)
      .expect(HttpStatus.OK);
    expect(archivedResponse.body).toEqual([
      expect.objectContaining({ id: created.id }),
    ]);

    await request(http)
      .patch(`/recurring-expenses/${created.id}/restore`)
      .set(authHeaders)
      .expect(HttpStatus.OK);
    await request(http)
      .patch(`/recurring-expenses/${created.id}/archive`)
      .set(authHeaders)
      .expect(HttpStatus.OK);
    await request(http)
      .delete(`/recurring-expenses/${created.id}`)
      .set(authHeaders)
      .expect(HttpStatus.NO_CONTENT);
    await request(http)
      .get(`/recurring-expenses/${created.id}`)
      .set(authHeaders)
      .expect(HttpStatus.NOT_FOUND);
  });

  it('isolates templates and relations between users', async () => {
    const vendor = await createVendor();
    const template = await createTemplate(vendor.id, undefined);
    const { authHeaders: otherHeaders } = await createAuth(http, {
      email: 'other@local.dev',
      fullName: 'Other User',
    });

    await request(http)
      .get(`/recurring-expenses/${template.id}`)
      .set(otherHeaders)
      .expect(HttpStatus.NOT_FOUND);
    await request(http)
      .patch(`/recurring-expenses/${template.id}`)
      .set(otherHeaders)
      .send({ description: 'Changed by another user' })
      .expect(HttpStatus.NOT_FOUND);
    await request(http)
      .post(`/recurring-expenses/${template.id}/generate`)
      .set(otherHeaders)
      .expect(HttpStatus.NOT_FOUND);
    await request(http)
      .post('/recurring-expenses')
      .set(otherHeaders)
      .send({
        vendorId: vendor.id,
        description: 'Foreign vendor template',
        amount: 10,
        frequency: 'WEEKLY',
        nextDueDate: '2026-09-01',
      })
      .expect(HttpStatus.NOT_FOUND);
  });

  it('generates a due expense once and advances the template atomically', async () => {
    const vendor = await createVendor();
    const category = await createCategory();
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() - 1);
    const dueDateValue = dueDate.toISOString().slice(0, 10);
    const template = await createTemplate(vendor.id, category.id, {
      nextDueDate: dueDateValue,
    });

    const generationResponse = await request(http)
      .post(`/recurring-expenses/${template.id}/generate`)
      .set(authHeaders)
      .expect(HttpStatus.CREATED);
    const expense = generationResponse.body as ExpenseResponse;

    expect(expense).toMatchObject({
      recurringExpenseTemplateId: template.id,
      description: 'Workspace subscription',
      amount: '45.5',
    });
    expect(expense.expenseDate.startsWith(dueDateValue)).toBe(true);

    const detailResponse = await request(http)
      .get(`/recurring-expenses/${template.id}`)
      .set(authHeaders)
      .expect(HttpStatus.OK);
    const advancedTemplate =
      detailResponse.body as RecurringExpenseTemplateResponse;
    expect(new Date(advancedTemplate.nextDueDate).getTime()).toBeGreaterThan(
      new Date(template.nextDueDate).getTime(),
    );

    await request(http)
      .post(`/recurring-expenses/${template.id}/generate`)
      .set(authHeaders)
      .expect(HttpStatus.CONFLICT);
    await expect(
      prisma.expense.count({
        where: { recurringExpenseTemplateId: template.id },
      }),
    ).resolves.toBe(1);
  });
});
