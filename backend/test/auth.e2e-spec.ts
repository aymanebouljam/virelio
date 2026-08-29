import { HttpStatus, type INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthMailMessage } from '../src/auth/auth-mail.service';
import { createTestApp, resetDatabase } from './test-app';
import { createAuth } from './test-auth';

type User = {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type ErrorResponse = {
  message: string;
  errors: { field: string }[];
};

describe('Auth e2e', () => {
  let app: INestApplication;
  let http: Server;
  let prisma: PrismaService;
  let authMailMessages: AuthMailMessage[];

  beforeAll(async () => {
    ({ app, http, prisma, authMailMessages } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    authMailMessages.length = 0;
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

      await prisma.user.update({
        where: { email: 'owner@local.dev' },
        data: { emailVerifiedAt: new Date() },
      });

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

    it('returns 401 when email has not been verified', async () => {
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
        .expect(HttpStatus.UNAUTHORIZED);

      expect(response.body).toEqual({
        message: 'Email address must be verified',
      });
    });

    it('logs in after confirming the token from the verification email', async () => {
      await request(http)
        .post('/auth/register')
        .send({
          email: 'owner@local.dev',
          password: 'password123',
          fullName: 'Local Owner',
        })
        .expect(HttpStatus.CREATED);

      expect(authMailMessages).toHaveLength(1);
      expect(authMailMessages[0].to).toBe('owner@local.dev');
      const verificationUrl = new URL(
        authMailMessages[0].text.replace('Verify your email: ', ''),
      );
      const token = verificationUrl.searchParams.get('token');
      expect(token).not.toBeNull();

      if (token === null) {
        throw new Error('Verification email did not include a token');
      }

      await request(http)
        .post('/auth/email-verification/confirm')
        .send({ token })
        .expect(HttpStatus.OK)
        .expect({ message: 'Email verified successfully' });

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

  describe('PATCH /auth/me', () => {
    it('updates and persists the authenticated user profile', async () => {
      const { authHeaders } = await createAuth(http);

      const response = await request(http)
        .patch('/auth/me')
        .set(authHeaders)
        .send({
          email: 'updated@local.dev',
          fullName: 'Updated Owner',
        })
        .expect(HttpStatus.OK);

      expect(response.body).toMatchObject({
        email: 'updated@local.dev',
        fullName: 'Updated Owner',
      });
      expect(response.body).not.toHaveProperty('passwordHash');

      const storedUser = await prisma.user.findUnique({
        where: { email: 'updated@local.dev' },
      });
      expect(storedUser).toMatchObject({
        email: 'updated@local.dev',
        fullName: 'Updated Owner',
      });

      const currentUser = await request(http)
        .get('/auth/me')
        .set(authHeaders)
        .expect(HttpStatus.OK);
      expect(currentUser.body).toMatchObject({
        email: 'updated@local.dev',
        fullName: 'Updated Owner',
      });
    });

    it.each([
      { caseName: 'an empty body', input: {}, fields: ['body'] },
      {
        caseName: 'invalid fields',
        input: { email: 'invalid-email', fullName: 'A' },
        fields: ['email', 'fullName'],
      },
    ])('rejects $caseName', async ({ input, fields }) => {
      const { authHeaders } = await createAuth(http);
      const response = await request(http)
        .patch('/auth/me')
        .set(authHeaders)
        .send(input)
        .expect(HttpStatus.BAD_REQUEST);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed');
      for (const field of fields) {
        expect(error.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ field })]),
        );
      }
    });

    it('rejects an email already used by another user', async () => {
      const { authHeaders } = await createAuth(http);
      await request(http)
        .post('/auth/register')
        .send({
          email: 'taken@local.dev',
          password: 'password123',
          fullName: 'Another Owner',
        })
        .expect(HttpStatus.CREATED);

      const response = await request(http)
        .patch('/auth/me')
        .set(authHeaders)
        .send({ email: 'taken@local.dev' })
        .expect(HttpStatus.CONFLICT);

      const error = response.body as ErrorResponse;
      expect(error.message).toBe('Validation failed');
      expect(error.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('requires authentication', async () => {
      await request(http)
        .patch('/auth/me')
        .send({ fullName: 'Updated Owner' })
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
