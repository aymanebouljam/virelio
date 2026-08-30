import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const verifyAsyncMock = jest.fn();
  const userFindUniqueMock = jest.fn();
  const jwtService = {
    verifyAsync: verifyAsyncMock,
  } as unknown as JwtService;
  const prisma = {
    user: {
      findUnique: userFindUniqueMock,
    },
  } as unknown as PrismaService;

  let guard: JwtAuthGuard;

  beforeEach(() => {
    jest.resetAllMocks();
    guard = new JwtAuthGuard(jwtService, prisma);
  });

  it('accepts a token with the current session version', async () => {
    const request = { headers: { authorization: 'Bearer access-token' } };
    const context = createContext(request);
    verifyAsyncMock.mockResolvedValueOnce({
      sub: 'user-1',
      email: 'owner@local.dev',
      sessionVersion: 2,
    });
    userFindUniqueMock.mockResolvedValueOnce({ sessionVersion: 2 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toEqual({
      sub: 'user-1',
      email: 'owner@local.dev',
      sessionVersion: 2,
    });
  });

  it('rejects a token from an earlier session version', async () => {
    const context = createContext({
      headers: { authorization: 'Bearer stale-token' },
    });
    verifyAsyncMock.mockResolvedValueOnce({
      sub: 'user-1',
      email: 'owner@local.dev',
      sessionVersion: 0,
    });
    userFindUniqueMock.mockResolvedValueOnce({ sessionVersion: 1 });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('accepts a legacy token while the user has the initial version', async () => {
    const context = createContext({
      headers: { authorization: 'Bearer legacy-token' },
    });
    verifyAsyncMock.mockResolvedValueOnce({
      sub: 'user-1',
      email: 'owner@local.dev',
    });
    userFindUniqueMock.mockResolvedValueOnce({ sessionVersion: 0 });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

function createContext(request: { headers: Record<string, string> }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
