import { HttpStatus, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';

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

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await rm(join(process.cwd(), 'uploads'), { recursive: true, force: true });
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await rm(join(process.cwd(), 'uploads'), { recursive: true, force: true });
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

  async function createExpense() {
    const vendor = await createVendor();

    const response = await request(http)
      .post('/expenses')
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

  describe('POST /expenses/:expenseId/proofs', () => {
    it('uploads a proof file for an active expense', async () => {
      const expense = await createExpense();

      const content = 'invoice content';

      const response = await request(http)
        .post(`/expenses/${expense.id}/proofs`)
        .attach('file', Buffer.from(content), 'invoice.txt')
        .expect(HttpStatus.CREATED);
      const createdProof = response.body as ProofResponse;

      expect(createdProof).toMatchObject({
        expenseId: expense.id,
        originalName: 'invoice.txt',
        mimeType: 'text/plain',
        sizeBytes: Buffer.byteLength(content),
      });

      expect(createdProof.storagePath).toContain('uploads');

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
        .attach('file', Buffer.from('invoice content'), 'invoice.txt')
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });

    it('returns 400 when no file is provided', async () => {
      const expense = await createExpense();

      const response = await request(http)
        .post(`/expenses/${expense.id}/proofs`)
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
        .attach('file', Buffer.from('invoice content'), 'invoice.txt')
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Expense not found');
    });
  });
});
