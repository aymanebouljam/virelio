import { HttpStatus, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';
import { getUploadsRoot } from '../src/proofs/proofs-paths';
import { createAuth } from './test-auth';

type ErrorResponse = {
  message: string;
  errors?: {
    field: string;
    constraints: Record<string, string>;
  }[];
};

type ProofResponse = {
  id: string;
  expenseId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
};

describe('Proofs e2e', () => {
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

  async function createVendor() {
    const response = await request(http)
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

    return response.body as { id: string };
  }

  async function createExpense() {
    const vendor = await createVendor();

    const response = await request(http)
      .post('/expenses')
      .set(authHeaders)
      .send({
        vendorId: vendor.id,
        description: 'Office supplies',
        amount: 1250.5,
        expenseDate: '2026-06-19',
        notes: 'Monthly stationery',
      })
      .expect(HttpStatus.CREATED);

    return response.body as { id: string };
  }
  const content = 'invoice content';
  async function createProof(expense: { id: string }) {
    const response = await request(http)
      .post(`/expenses/${expense.id}/proofs`)
      .set(authHeaders)
      .attach('file', Buffer.from(content), 'invoice.txt')
      .expect(HttpStatus.CREATED);

    return response.body as ProofResponse;
  }

  describe('POST /expenses/:expenseId/proofs', () => {
    it('uploads a proof file for an active expense', async () => {
      const expense = await createExpense();

      const content = 'invoice content';

      const response = await request(http)
        .post(`/expenses/${expense.id}/proofs`)
        .set(authHeaders)
        .attach('file', Buffer.from(content), 'invoice.txt')
        .expect(HttpStatus.CREATED);
      const createdProof = response.body as ProofResponse;

      expect(createdProof).toMatchObject({
        expenseId: expense.id,
        originalName: 'invoice.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(content),
      });

      expect(createdProof.storagePath).toMatch(
        new RegExp(`^uploads/proofs/${expense.id}/[^/]+\\.txt$`),
      );

      const storedProof = await prisma.proofDocument.findUnique({
        where: { id: createdProof.id },
      });

      expect(storedProof).not.toBeNull();
      expect(storedProof).toMatchObject({
        id: createdProof.id,
        expenseId: expense.id,
        originalName: 'invoice.txt',
        mimeType: 'text/plain',
      });
    });

    it('returns 400 when the expense ID is not a valid UUID', async () => {
      const response = await request(http)
        .post('/expenses/not-a-uuid/proofs')
        .set(authHeaders)
        .attach('file', Buffer.from('invoice content'), 'invoice.txt')
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 400 when no file is provided', async () => {
      const expense = await createExpense();

      const response = await request(http)
        .post(`/expenses/${expense.id}/proofs`)
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body).toEqual({
        message: 'Validation failed',
        errors: [
          {
            field: 'file',
            constraints: {
              isDefined: 'A proof file is required',
            },
          },
        ],
      });
    });

    it('returns 404 when the expense does not exist', async () => {
      const response = await request(http)
        .post(`/expenses/${randomUUID()}/proofs`)
        .set(authHeaders)
        .attach('file', Buffer.from('invoice content'), 'invoice.txt')
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });
  });

  describe('GET /expenses/:expenseId/proofs/:proofId', () => {
    it('downloads an owned proof through the authenticated endpoint', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);

      const response = await request(http)
        .get(`/expenses/${expense.id}/proofs/${createdProof.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK)
        .expect('Content-Type', /^text\/plain/);

      expect(response.text).toBe(content);
      expect(response.headers['content-length']).toBe(
        String(Buffer.byteLength(content)),
      );
    });

    it('returns 401 without authentication', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);

      await request(http)
        .get(`/expenses/${expense.id}/proofs/${createdProof.id}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('returns 404 when another user requests the proof', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);
      const { authHeaders: otherUserHeaders } = await createAuth(http, {
        email: 'proof-viewer@local.dev',
        fullName: 'Proof Viewer',
      });

      await request(http)
        .get(`/expenses/${expense.id}/proofs/${createdProof.id}`)
        .set(otherUserHeaders)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /expenses/:expenseId/proofs/:proofId', () => {
    it('remove a proof for an active expense', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);
      expect(createdProof).toMatchObject({
        expenseId: expense.id,
        originalName: 'invoice.txt',
      });

      await request(http)
        .delete(`/expenses/${expense.id}/proofs/${createdProof.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NO_CONTENT);
      const proof = await prisma.proofDocument.findUnique({
        where: {
          id: createdProof.id,
        },
      });
      expect(proof).toBeNull();
    });
    it('returns 400 when the expense ID is not a valid UUID', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);
      expect(createdProof).toMatchObject({
        expenseId: expense.id,
        originalName: 'invoice.txt',
      });

      const response = await request(http)
        .delete(`/expenses/not-a-uuid/proofs/${createdProof.id}`)
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 400 when the proof document ID is not a valid UUID', async () => {
      const expense = await createExpense();

      const response = await request(http)
        .delete(`/expenses/${expense.id}/proofs/not-a-uuid`)
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 404 when the expense does not exist', async () => {
      const expense = await createExpense();
      const createdProof = await createProof(expense);
      expect(createdProof).toMatchObject({
        expenseId: expense.id,
        originalName: 'invoice.txt',
      });

      const response = await request(http)
        .delete(`/expenses/${randomUUID()}/proofs/${createdProof.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });

    it('returns 404 when the proof document does not exist', async () => {
      const expense = await createExpense();

      const response = await request(http)
        .delete(`/expenses/${expense.id}/proofs/${randomUUID()}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Proof document not found');
    });
  });
});
