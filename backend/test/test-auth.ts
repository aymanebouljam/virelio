import { JwtService } from '@nestjs/jwt';
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

  const registration = (await request(http).post('/auth/register').send({
    email,
    password,
    fullName,
  })) as { body: { id: string } };

  const jwtService = new JwtService({
    secret: process.env.AUTH_JWT_SECRET,
  });
  const accessToken = await jwtService.signAsync({
    sub: registration.body.id,
    email,
  });

  return {
    userId: registration.body.id,
    authHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}
