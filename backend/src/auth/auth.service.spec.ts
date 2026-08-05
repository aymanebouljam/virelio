import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const signAsyncMock = jest.fn();
  const verifyAsyncMock = jest.fn();
  const jwtService = {
    signAsync: signAsyncMock,
    verifyAsync: verifyAsyncMock,
  } as unknown as JwtService;

  const userFindUniqueMock = jest.fn();
  const userCreateMock = jest.fn();
  const userUpdateMock = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUniqueMock,
      create: userCreateMock,
      update: userUpdateMock,
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AuthService(prisma, jwtService);
  });

  it('registers a new user', async () => {
    userFindUniqueMock.mockResolvedValueOnce(null);
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('hashed-password');
    userCreateMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@local.dev',
      fullName: 'Local Owner',
      createdAt: new Date('2026-06-27T10:00:00.000Z'),
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });

    await expect(
      service.register({
        email: 'owner@local.dev',
        password: 'password123',
        fullName: 'Local Owner',
      }),
    ).resolves.toMatchObject({
      id: 'user-1',
      email: 'owner@local.dev',
      fullName: 'Local Owner',
    });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { email: 'owner@local.dev' },
      select: { id: true },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    expect(userCreateMock).toHaveBeenCalledWith({
      data: {
        email: 'owner@local.dev',
        passwordHash: 'hashed-password',
        fullName: 'Local Owner',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('rejects register when email already exists', async () => {
    userFindUniqueMock.mockResolvedValueOnce({ id: 'user-1' });

    await expect(
      service.register({
        email: 'owner@local.dev',
        password: 'password123',
        fullName: 'Local Owner',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it('logs in a user with valid credentials', async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@local.dev',
      fullName: 'Local Owner',
      passwordHash: 'hashed-password',
      createdAt: new Date('2026-06-27T10:00:00.000Z'),
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    await expect(
      service.login({
        email: 'owner@local.dev',
        password: 'password123',
      }),
    ).resolves.toMatchObject({
      id: 'user-1',
      email: 'owner@local.dev',
      fullName: 'Local Owner',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith(
      'password123',
      'hashed-password',
    );
  });

  it('rejects login when user does not exist', async () => {
    userFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.login({
        email: 'owner@local.dev',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when password is invalid', async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@local.dev',
      fullName: 'Local Owner',
      passwordHash: 'hashed-password',
      createdAt: new Date('2026-06-27T10:00:00.000Z'),
      updatedAt: new Date('2026-06-27T10:00:00.000Z'),
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.login({
        email: 'owner@local.dev',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('updates the authenticated user profile', async () => {
    const updatedUser = {
      id: 'user-1',
      email: 'updated@local.dev',
      fullName: 'Updated Owner',
      createdAt: new Date('2026-06-27T10:00:00.000Z'),
      updatedAt: new Date('2026-08-05T10:00:00.000Z'),
    };
    userUpdateMock.mockResolvedValueOnce(updatedUser);

    await expect(
      service.updateProfile('user-1', {
        email: 'updated@local.dev',
        fullName: 'Updated Owner',
      }),
    ).resolves.toEqual(updatedUser);

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'updated@local.dev',
        fullName: 'Updated Owner',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it('rejects an empty profile update', async () => {
    await expect(service.updateProfile('user-1', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects a profile email already used by another user', async () => {
    userUpdateMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Field already exists', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.updateProfile('user-1', { email: 'taken@local.dev' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
