import request from 'supertest';
import { createTestApp, resetDatabase } from './test-app';
import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import type { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { createAuth } from './test-auth';

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
  let authHeaders: Record<string, string>;
  let userId: string;

  beforeAll(async () => {
    ({ app, http, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    ({ authHeaders, userId } = await createAuth(http));
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app?.close();
  });

  describe('GET /vendors', () => {
    it('returns empty list initially', async () => {
      const listResponse = await request(http)
        .get('/vendors')
        .set(authHeaders)
        .expect(HttpStatus.OK);
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
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);

      const createdVendor = createResponse.body as VendorResponse;
      const archivedResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

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

      await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/vendors')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const vendorsList = listResponse.body as VendorResponse[];
      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject(inputB);
      expect(vendorsList[0].archivedAt).toBeNull();
      expect(vendorsList.some((vendor) => vendor.name === inputA.name)).toBe(
        false,
      );
    });
    it('lists the most recently created active vendors first', async () => {
      const inputA = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponseA = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);
      const vendorA = createResponseA.body as VendorResponse;
      await prisma.vendor.update({
        where: { id: vendorA.id },
        data: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
      });

      const inputB = {
        name: 'Northstar Business Solutions',
        email: 'contact@northstar.ma',
        phone: '+212661234567',
        website: 'https://northstar.ma',
        notes: 'Business equipment and workplace essentials supplier',
      };

      const createResponseB = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);
      const vendorB = createResponseB.body as VendorResponse;
      await prisma.vendor.update({
        where: { id: vendorB.id },
        data: { createdAt: new Date('2026-01-02T00:00:00.000Z') },
      });
      const listResponse = await request(http)
        .get('/vendors')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const vendors = listResponse.body as VendorResponse[];
      expect(vendors.map(({ id }) => id)).toEqual([vendorB.id, vendorA.id]);
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
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdVendor = createResponse.body as VendorResponse;

      const findOneResponse = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const vendor = findOneResponse.body as VendorResponse;
      expect(vendor).toMatchObject(input);
      expect(vendor.id).toBe(createdVendor.id);
      expect(vendor.archivedAt).toBeNull();
    });
    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const response = await request(http)
        .get('/vendors/not-a-uuid')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);
      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
    it('returns 404 when the vendor does not exist', async () => {
      const response = await request(http)
        .get(`/vendors/${randomUUID()}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);
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
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdVendor = createResponse.body as VendorResponse;

      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const response = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
  });
  describe('GET /vendors/archived', () => {
    it('returns an empty array when no archived vendors exist', async () => {
      const listResponse = await request(http)
        .get('/vendors/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);
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
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);

      const createdVendor = createResponse.body as VendorResponse;
      const archivedResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

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

      await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);

      const listResponse = await request(http)
        .get('/vendors/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const vendorsList = listResponse.body as VendorResponse[];
      expect(vendorsList).toHaveLength(1);
      expect(vendorsList[0]).toMatchObject(inputA);
      expect(vendorsList[0].archivedAt).not.toBeNull();
      expect(vendorsList.some((vendor) => vendor.name === inputB.name)).toBe(
        false,
      );
    });
    it('lists the most recently archived vendors first', async () => {
      const inputA = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponseA = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputA)
        .expect(HttpStatus.CREATED);
      const vendorA = createResponseA.body as VendorResponse;
      await request(http)
        .patch(`/vendors/${vendorA.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await prisma.vendor.update({
        where: { id: vendorA.id },
        data: { archivedAt: new Date('2026-01-01T00:00:00.000Z') },
      });

      const inputB = {
        name: 'Northstar Business Solutions',
        email: 'contact@northstar.ma',
        phone: '+212661234567',
        website: 'https://northstar.ma',
        notes: 'Business equipment and workplace essentials supplier',
      };

      const createResponseB = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(inputB)
        .expect(HttpStatus.CREATED);
      const vendorB = createResponseB.body as VendorResponse;
      await request(http)
        .patch(`/vendors/${vendorB.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await prisma.vendor.update({
        where: { id: vendorB.id },
        data: { archivedAt: new Date('2026-01-02T00:00:00.000Z') },
      });
      const listArchivedResponse = await request(http)
        .get('/vendors/archived')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archivedVendors = listArchivedResponse.body as VendorResponse[];
      expect(archivedVendors.map(({ id }) => id)).toEqual([
        vendorB.id,
        vendorA.id,
      ]);
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
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);

      const createdVendor = createResponse.body as VendorResponse;

      expect(createdVendor).toMatchObject({
        ...input,
        archivedAt: null,
      });

      expect(typeof createdVendor.id).toBe('string');
      expect(createdVendor.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(createdVendor.createdAt))).toBe(false);
      expect(Number.isNaN(Date.parse(createdVendor.updatedAt))).toBe(false);

      const listResponse = await request(http)
        .get('/vendors')
        .set(authHeaders)
        .expect(HttpStatus.OK);

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
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.BAD_REQUEST);

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

      const listResponse = await request(http)
        .get('/vendors')
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const vendorsList = listResponse.body as VendorResponse[];

      expect(vendorsList).toHaveLength(0);
    });
    it.each([
      ['name', 'Atlas Office Supplies'],
      ['email', 'contact@atlasoffice.com'],
      ['phone', '+212600000001'],
      ['website', 'https://atlasoffice.com'],
    ] as const)(
      'rejects creation when %s is already in use and returns 409',
      async (field, value) => {
        const inputA = {
          name: 'Atlas Office Supplies',
          email: 'contact@atlasoffice.com',
          phone: '+212600000001',
          website: 'https://atlasoffice.com',
          notes: 'Office supplies vendor',
        };

        const createResponse = await request(http)
          .post('/vendors')
          .set(authHeaders)
          .send(inputA)
          .expect(HttpStatus.CREATED);
        const createdVendor = createResponse.body as VendorResponse;

        const inputB = {
          name: 'Rif Medical Supplies',
          email: 'contact@rifmedical.ma',
          phone: '+212634567890',
          website: 'https://www.rifmedical.ma',
          notes: 'Medical equipment and clinic supplies provider',
          [field]: value,
        };

        const response = await request(http)
          .post('/vendors')
          .set(authHeaders)
          .send(inputB)
          .expect(HttpStatus.CONFLICT);

        const error = response.body as ErrorResponse;

        expect(error.message).toBe('Validation failed');
        expect(error.errors).toEqual([
          {
            field,
            constraints: {
              isUnique: `A vendor with this ${field} already exists`,
            },
          },
        ]);
        const listResponse = await request(http)
          .get('/vendors')
          .set(authHeaders)
          .expect(HttpStatus.OK);

        const vendorsList = listResponse.body as VendorResponse[];

        expect(vendorsList).toHaveLength(1);
        expect(vendorsList[0]).toMatchObject({
          id: createdVendor.id,
          ...inputA,
          archivedAt: null,
        });
      },
    );
  });
  describe('PATCH /vendors/:id', () => {
    it('updates an existing vendor', async () => {
      const createInput = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const updateInput = {
        phone: '+212600000099',
        website: 'https://new-atlas.com',
      };

      const expectedVendor = {
        ...createInput,
        ...updateInput,
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(createInput)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      expect(createdVendor).toMatchObject({
        ...createInput,
        archivedAt: null,
      });

      const updateResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .send(updateInput)
        .expect(HttpStatus.OK);

      expect(updateResponse.body).toMatchObject({
        id: createdVendor.id,
        ...expectedVendor,
        archivedAt: null,
      });

      const getResponse = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const vendor = getResponse.body as VendorResponse;

      expect(vendor).toMatchObject({
        id: createdVendor.id,
        ...expectedVendor,
        archivedAt: null,
      });
    });
    it('returns 400 when the request body is empty', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      expect(createdVendor).toMatchObject({
        ...input,
        archivedAt: null,
      });
      const updateResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
      const error = updateResponse.body as ErrorResponse;
      expect(error.message).toBe('Validation failed');
      expect(error.errors[0]).toEqual({
        field: 'body',
        constraints: {
          isNotEmpty: 'Update body cannot be empty',
        },
      });
    });

    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };
      const response = await request(http)
        .patch('/vendors/not-a-uuid')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.BAD_REQUEST);
      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
    it('returns 404 when the vendor does not exist', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };
      const response = await request(http)
        .patch(`/vendors/${randomUUID()}`)
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.NOT_FOUND);
      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
    it.each([
      ['name', 'Sahara Tech Solutions'],
      ['email', 'contact@saharatech.ma'],
      ['phone', '+212623456789'],
      ['website', 'https://www.saharatech.ma'],
    ] as const)(
      'returns 409 when %s is already in use',
      async (field, value) => {
        const inputA = {
          name: 'Atlas Office Supplies',
          email: 'contact@atlasoffice.com',
          phone: '+212600000001',
          website: 'https://atlasoffice.com',
          notes: 'Office supplies vendor',
        };

        const createResponse = await request(http)
          .post('/vendors')
          .set(authHeaders)
          .send(inputA)
          .expect(HttpStatus.CREATED);

        const createdVendor = createResponse.body as VendorResponse;

        const inputB = {
          name: 'Sahara Tech Solutions',
          email: 'contact@saharatech.ma',
          phone: '+212623456789',
          website: 'https://www.saharatech.ma',
          notes: 'IT hardware and technical support provider',
        };

        await request(http)
          .post('/vendors')
          .set(authHeaders)
          .send(inputB)
          .expect(HttpStatus.CREATED);

        const response = await request(http)
          .patch(`/vendors/${createdVendor.id}`)
          .set(authHeaders)
          .send({
            [field]: value,
          })
          .expect(HttpStatus.CONFLICT);

        const error = response.body as ErrorResponse;
        expect(error.message).toBe('Validation failed');
        expect(error.errors).toEqual([
          {
            field,
            constraints: {
              isUnique: `A vendor with this ${field} already exists`,
            },
          },
        ]);
      },
    );
  });
  describe('PATCH /vendors/:id/archive', () => {
    it('archives an active vendor', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      expect(createdVendor).toMatchObject({
        ...input,
        archivedAt: null,
      });
      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archivedResponse = await request(http)
        .get(`/vendors/archived`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archivedVendor = archivedResponse.body as VendorResponse[];
      expect(archivedVendor[0].id).toBe(createdVendor.id);
      expect(archivedVendor[0].archivedAt).not.toBeNull();
    });
    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const archiveResponse = await request(http)
        .patch('/vendors/not-a-uuid/archive')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);
      const error = archiveResponse.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
    it('returns 404 when the vendor does not exist', async () => {
      const archiveResponse = await request(http)
        .patch(`/vendors/${randomUUID()}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);
      const error = archiveResponse.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
    it('returns 409 when the vendor is already archived', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archiveResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);
      expect(archiveResponse.body).toEqual({
        message: 'Resource archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor is already archived',
            },
          },
        ],
      });
    });
  });
  describe('PATCH /vendors/:id/restore', () => {
    it('restores an archived vendor', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      expect(createdVendor).toMatchObject({
        ...input,
        archivedAt: null,
      });
      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archivedResponse = await request(http)
        .get(`/vendors/archived`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const archivedVendor = archivedResponse.body as VendorResponse[];
      expect(archivedVendor[0].id).toBe(createdVendor.id);
      expect(archivedVendor[0].archivedAt).not.toBeNull();
      await request(http)
        .patch(`/vendors/${createdVendor.id}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const restoreResponse = await request(http)
        .get(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.OK);
      const restoredVendor = restoreResponse.body as VendorResponse;
      expect(restoredVendor).toMatchObject({
        id: createdVendor.id,
        ...input,
        archivedAt: null,
      });
    });
    it('returns 404 when the vendor does not exist', async () => {
      const restoreResponse = await request(http)
        .patch(`/vendors/${randomUUID()}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);
      const error = restoreResponse.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
    it('returns 409 when the vendor is already active', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };

      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      const restoreResponse = await request(http)
        .patch(`/vendors/${createdVendor.id}/restore`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);
      expect(restoreResponse.body).toEqual({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor is not archived',
            },
          },
        ],
      });
    });
    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const restoreResponse = await request(http)
        .patch('/vendors/not-a-uuid/restore')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);
      const error = restoreResponse.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
  });
  describe('DELETE /vendors/:id', () => {
    it('deletes an archived vendor', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };
      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      await request(http)
        .delete(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.NO_CONTENT);

      const deletedVendor = await prisma.vendor.findUnique({
        where: { id: createdVendor.id },
      });
      expect(deletedVendor).toBeNull();
    });
    it('returns 404 when the vendor does not exist', async () => {
      const deleteResponse = await request(http)
        .delete(`/vendors/${randomUUID()}`)
        .set(authHeaders)
        .expect(HttpStatus.NOT_FOUND);
      const error = deleteResponse.body as ErrorResponse;
      expect(error.message).toBe('Vendor not found');
    });
    it('returns 409 when the vendor is still active', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };
      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;

      const deleteResponse = await request(http)
        .delete(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      const error = deleteResponse.body as ErrorResponse;
      expect(error).toMatchObject({
        message: 'Resource not archived',
        errors: [
          {
            field: 'archivedAt',
            constraints: {
              exists: 'This vendor should be archived in order to be deleted',
            },
          },
        ],
      });
      const persistedVendor = await prisma.vendor.findUnique({
        where: { id: createdVendor.id },
      });
      expect(persistedVendor).toMatchObject({
        id: createdVendor.id,
        ...input,
        archivedAt: null,
      });
    });
    it('returns 400 when the vendor ID is not a valid UUID', async () => {
      const deleteResponse = await request(http)
        .delete('/vendors/not-a-uuid')
        .set(authHeaders)
        .expect(HttpStatus.BAD_REQUEST);
      const error = deleteResponse.body as ErrorResponse;
      expect(error.message).toBe('Validation failed (uuid v 4 is expected)');
    });
    it('returns 409 when the vendor is still linked to expenses', async () => {
      const input = {
        name: 'Atlas Office Supplies',
        email: 'contact@atlasoffice.com',
        phone: '+212600000001',
        website: 'https://atlasoffice.com',
        notes: 'Office supplies vendor',
      };
      const createResponse = await request(http)
        .post('/vendors')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.CREATED);
      const createdVendor = createResponse.body as VendorResponse;
      await prisma.expense.create({
        data: {
          userId,
          vendorId: createdVendor.id,
          description: 'Office supplies purchase',
          amount: 1250.5,
          expenseDate: new Date('2026-01-15T00:00:00.000Z'),
          notes: 'Monthly stationery and printer supplies',
        },
      });

      await request(http)
        .patch(`/vendors/${createdVendor.id}/archive`)
        .set(authHeaders)
        .expect(HttpStatus.OK);

      const deleteResponse = await request(http)
        .delete(`/vendors/${createdVendor.id}`)
        .set(authHeaders)
        .expect(HttpStatus.CONFLICT);

      const error = deleteResponse.body as ErrorResponse;
      expect(error).toMatchObject({
        message: 'Vendor cannot be deleted because it has expenses',
      });
      const persistedVendor = await prisma.vendor.findUnique({
        where: { id: createdVendor.id },
      });
      expect(persistedVendor).toMatchObject({
        id: createdVendor.id,
        ...input,
      });
      expect(persistedVendor?.archivedAt).not.toBeNull();
      const persistedExpense = await prisma.expense.findFirst({
        where: { vendorId: createdVendor.id },
      });

      expect(persistedExpense).not.toBeNull();
    });
  });
});
