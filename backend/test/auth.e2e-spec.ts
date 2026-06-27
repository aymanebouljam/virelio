import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import { createTestApp, resetDatabase } from './test-app';

type User = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

describe('Auth e2e', () => {
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

  describe('POST /auth/register', () => {
    it('registers a new user', async () => {
      const response = await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CREATED);

      expect(response.body).toMatchObject({
        email: 'owner@local.dev',
        fullName: 'Local Owner',
      });

      const storedUser = (await prisma.user.findUnique({
        where: {
          email: 'owner@local.dev',
        },
      })) as User;

      expect(storedUser).not.toBeNull();
      expect(storedUser.passwordHash).not.toBe('password123');
    });

    it('returns 409 when email already exists', async () => {
      await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CONFLICT);

      expect(response.body).toEqual({
        message: 'User already exists',
      });
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with valid credentials', async () => {
      await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .post('/auth/login')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
        })
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        email: 'owner@local.dev',
        fullName: 'Local Owner',
      });
    });

    it('returns 401 when credentials are invalid', async () => {
      await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .post('/auth/login')
        .send({
          email: 'owner@local.dev',
          password: 'wrong-password',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        message: 'Invalid credentials',
      });
    });

    it('returns 401 when user does not exist', async () => {
      const response = await request(http)
        .post('/auth/login')
        .send({
          email: 'missing@local.dev',
          password: 'password123',
        })
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        message: 'Invalid credentials',
      });
    });
  });
});
