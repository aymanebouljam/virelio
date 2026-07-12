import request from 'supertest';
import type { Server } from 'node:http';

type AuthInput = {
  email?: string;
  password?: string;
  fullName?: string;
};
export async function createAuth(http: Server, input: AuthInput = {}) {
  const email = input.email ?? 'owner@local.dev';
  const password = input.password ?? 'password123';
  const fullName = input.fullName ?? 'Local Owner';

  await request(http).post('/auth/register').send({
    email,
    password,
    fullName,
  });

  const response = (await request(http).post('/auth/login').send({
    email,
    password,
  })) as { body: { id: string; accessToken: string } };

  return {
    userId: response.body.id,
    authHeaders: {
      Authorization: `Bearer ${response.body.accessToken}`,
    },
  };
}
