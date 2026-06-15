import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { createTestApp } from './test-app';

describe('App e2e', () => {
  let app: INestApplication;
  let http: Server;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET / returns backend sanity check', async () => {
    await request(http).get('/').expect(200).expect('Hello World!');
  });

  it('GET /health returns backend health', async () => {
    await request(http).get('/health').expect(200).expect({
      status: 'ok',
      service: 'backend',
    });
  });
});
