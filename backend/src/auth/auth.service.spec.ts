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
import { AuthMailService } from './auth-mail.service';
import { ConfigService } from '@nestjs/config';

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
  const authTokenUpsertMock = jest.fn();
  const authTokenFindUniqueMock = jest.fn();
  const authTokenDeleteMock = jest.fn();
  const transactionMock = jest.fn();
  const sendMailMock = jest.fn();

  const prisma = {
    user: {
      findUnique: userFindUniqueMock,
      create: userCreateMock,
      update: userUpdateMock,
    },
    authToken: {
      upsert: authTokenUpsertMock,
      findUnique: authTokenFindUniqueMock,
      delete: authTokenDeleteMock,
    },
    $transaction: transactionMock,
  } as unknown as PrismaService;

  const authMailService = {
    send: sendMailMock,
  } as unknown as AuthMailService;
  const configGetOrThrowMock = jest.fn();
  const configService = {
    getOrThrow: configGetOrThrowMock,
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.resetAllMocks();
    configGetOrThrowMock.mockReturnValue('http://localhost:5173');
    service = new AuthService(
      prisma,
      jwtService,
      authMailService,
      configService,
    );
  });

  it('registers a new user and sends an email verification link', async () => {
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
    expect(authTokenUpsertMock).toHaveBeenCalledWith({
      where: {
        userId_type: {
          userId: 'user-1',
          type: 'EMAIL_VERIFICATION',
        },
      },
      create: {
        userId: 'user-1',
        tokenHash: expect.any(String) as unknown,
        type: 'EMAIL_VERIFICATION',
        expiresAt: expect.any(Date) as unknown,
      },
      update: {
        tokenHash: expect.any(String) as unknown,
        expiresAt: expect.any(Date) as unknown,
      },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      to: 'owner@local.dev',
      subject: 'Verify your Virelio email',
      text: expect.stringMatching(
        /^Verify your email: http:\/\/localhost:5173\/verify-email\?token=/,
      ) as unknown,
      html: expect.stringContaining(
        'href="http://localhost:5173/verify-email?token=',
      ) as unknown,
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

  it('does not reveal whether a password reset email exists', async () => {
    userFindUniqueMock.mockResolvedValueOnce(null);

    await expect(
      service.requestPasswordReset({ email: 'unknown@example.com' }),
    ).resolves.toEqual({
      message:
        'If an account exists for that email, a password reset link has been sent.',
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(authTokenUpsertMock).not.toHaveBeenCalled();
  });

  it('stores a hash and emails the raw password reset token', async () => {
    userFindUniqueMock.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@example.com',
    });

    await service.requestPasswordReset({ email: 'owner@example.com' });

    expect(authTokenUpsertMock).toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalled();
  });

  it('resets a password and consumes a valid reset token', async () => {
    authTokenFindUniqueMock.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      type: 'PASSWORD_RESET',
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    });
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce('new-hashed-password');
    transactionMock.mockResolvedValueOnce([]);

    await expect(
      service.confirmPasswordReset({
        token: 'valid-reset-token',
        password: 'new-password',
      }),
    ).resolves.toEqual({ message: 'Password reset successfully' });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hashed-password' },
    });
    expect(authTokenDeleteMock).toHaveBeenCalledWith({
      where: { id: 'token-1' },
    });
  });

  it('rejects an expired password reset token', async () => {
    authTokenFindUniqueMock.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      type: 'PASSWORD_RESET',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(
      service.confirmPasswordReset({
        token: 'expired-reset-token',
        password: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(authTokenDeleteMock).not.toHaveBeenCalled();
  });

  it('marks an email as verified and consumes the token', async () => {
    authTokenFindUniqueMock.mockResolvedValueOnce({
      id: 'token-1',
      userId: 'user-1',
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    });
    transactionMock.mockResolvedValueOnce([]);

    await expect(
      service.confirmEmailVerification({ token: 'verification-token' }),
    ).resolves.toEqual({ message: 'Email verified successfully' });

    expect(userUpdateMock).toHaveBeenCalled();
    expect(authTokenDeleteMock).toHaveBeenCalledWith({
      where: { id: 'token-1' },
    });
  });
});
