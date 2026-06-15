import request from 'supertest';
import { createTestApp, resetDatabase } from './test-app';
import { type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';

type VendorResponse = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type ErrorResponse = {
  message: string;
  errors: {
    field: string;
    constraints: Record<string, string>;
  }[];
};

describe('Vendors e2e', () => {
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
    await app.close();
  });

  describe('GET /vendors', () => {
    it('returns empty list initially', async () => {
      const listResponse = await request(http).get('/vendors').expect(200);
      expect(listResponse.body).toEqual([]);
    });
    it('returns active vendors only', async () => {
      const inputA = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .send(inputA)
        .expect(201);

      const createdVendor = createResponse.body as VendorResponse;
      const archivedResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .expect(200);

      const archivedVendor = archivedResponse.body as VendorResponse;
      expect(archivedVendor.name).toBe(inputA.name);
      expect(archivedVendor.archivedAt).not.toBeNull();

      const inputB = {
        name: 'Northstar Business Solutions',
        email: 'contact@northstar.ma',
        phone: '+212661234567',
        website: 'https://northstar.ma',
        notes: 'Business equipment and workplace essentials supplier',
      };

      await request(http).post('/vendors').send(inputB).expect(201);

      const listResponse = await request(http).get('/vendors').expect(200);
      const vendorsList = listResponse.body as VendorResponse[];
      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject(inputB);
      expect(vendorsList[0].archivedAt).toBeNull();
      expect(vendorsList.some((vendor) => vendor.name === inputA.name)).toBe(
        false,
      );
    });
  });
  describe('GET /vendors/:id', () => {
    it('returns the vendor when it exists and is active', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .send(input)
        .expect(201);

      const createdVendor = createResponse.body as VendorResponse;

      const findOneResponse = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .expect(200);
      const vendor = findOneResponse.body as VendorResponse;
      expect(vendor).toMatchObject(input);
      expect(vendor.id).toBe(createdVendor.id);
      expect(vendor.archivedAt).toBeNull();
    });
    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const response = await request(http)
        .get('/vendors/not-a-uuid')
        .expect(400);
      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
    it('returns 404 when the vendor does not exist', async () => {
      const response = await request(http)
        .get(`/vendors/${randomUUID()}`)
        .expect(404);
      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
    it('returns 404 when the vendor is archived', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .send(input)
        .expect(201);

      const createdVendor = createResponse.body as VendorResponse;

      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .expect(200);
      const response = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .expect(404);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
  });
  describe('GET /vendors/archived', () => {
    it('returns an empty array when no archived vendors exist', async () => {
      const listResponse = await request(http)
        .get('/vendors/archived')
        .expect(200);
      expect(listResponse.body).toEqual([]);
    });
    it('returns archived vendors only', async () => {
      const inputA = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .send(inputA)
        .expect(201);

      const createdVendor = createResponse.body as VendorResponse;
      const archivedResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .expect(200);

      const archivedVendor = archivedResponse.body as VendorResponse;
      expect(archivedVendor.name).toBe(inputA.name);
      expect(archivedVendor.archivedAt).not.toBeNull();

      const inputB = {
        name: 'Northstar Business Solutions',
        email: 'contact@northstar.ma',
        phone: '+212661234567',
        website: 'https://northstar.ma',
        notes: 'Business equipment and workplace essentials supplier',
      };

      await request(http).post('/vendors').send(inputB).expect(201);

      const listResponse = await request(http)
        .get('/vendors/archived')
        .expect(200);
      const vendorsList = listResponse.body as VendorResponse[];
      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject(inputA);
      expect(vendorsList[0].archivedAt).not.toBeNull();
      expect(vendorsList.some((vendor) => vendor.name === inputB.name)).toBe(
        false,
      );
    });
  });

  describe('POST /vendors', () => {
    it('creates a vendor and returns it from GET /vendors', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .send(input)
        .expect(201);

      const createdVendor = createResponse.body as VendorResponse;

      expect(createdVendor).toMatchObject({
        ...input,
        archivedAt: null,
      });

      expect(typeof createdVendor.id).toBe('string');
      expect(createdVendor.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(createdVendor.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(createdVendor.updatedAt))).toBe(false);

      const listResponse = await request(http).get('/vendors').expect(200);

      const vendorsList = listResponse.body as VendorResponse[];

      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject({
        id: createdVendor.id,
        ...input,
        archivedAt: null,
      });
    });
    it('rejects vendor creation with invalid payload and returns 400', async () => {
      const input = {
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const response = await request(http)
        .post('/vendors')
        .send(input)
        .expect(400);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      const nameError = error.errors.find(
        (validationError) => validationError.field === 'name',
      );

      expect(nameError).toBeDefined();
      if (!nameError) {
        throw new Error('Expected validation error for "name"');
      }

      expect(typeof nameError.constraints.isString).toBe('string');
      expect(typeof nameError.constraints.isNotEmpty).toBe('string');

      const listResponse = await request(http).get('/vendors').expect(200);

      const vendorsList = listResponse.body as VendorResponse[];

      expect(vendorsList).toHaveLength(0);
    });
    it('rejects duplicate vendor creation and returns 409', async () => {
      const inputA = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      await request(http).post('/vendors').send(inputA).expect(201);

      const inputB = {
        name: 'Atlas Office Supplies',
        email: 'hello@atlasoffice.ma',
        phone: '+212612345678',
        website: 'https://www.atlasoffice.ma',
        notes: 'Preferred stationery and office equipment supplier',
      };

      const response = await request(http)
        .post('/vendors')
        .send(inputB)
        .expect(409);

      const error = response.body as ErrorResponse;

      expect(error.message).toBe('Validation failed');
      const nameError = error.errors.find(
        (validationError) => validationError.field === 'name',
      );

      expect(nameError).toBeDefined();
      if (!nameError) {
        throw new Error('Expected validation error for "name"');
      }

      expect(nameError.constraints.isUnique).toBe(
        'A vendor with this name already exists',
      );

      const listResponse = await request(http).get('/vendors').expect(200);

      const vendorsList = listResponse.body as VendorResponse[];

      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject(inputA);
      expect(vendorsList.some((vendor) => vendor.email === inputB.email)).toBe(
        false,
      );
    });
  });
});
