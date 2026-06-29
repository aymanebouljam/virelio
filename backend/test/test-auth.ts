import request from 'supertest';
import type { Server } from 'node:http';

export async function createAuthHeader(http: Server) {
  const email = 'owner@local.dev';
  const password = 'password123';
  const fullName = 'Local Owner';

  await request(http).post('/auth/register').send({
    email,
    password,
    fullName,
  });

  const response = (await request(http).post('/auth/login').send({
    email,
    password,
  })) as { body: { accessToken: string } };

  return {
    Authorization: `Bearer ${response.body.accessToken}`,
  };
}
