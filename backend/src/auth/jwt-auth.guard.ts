import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from './auth.types';

type AuthenticatedRequest = Request & {
  user?: JwtUser;
};

type JwtPayload = JwtUser & {
  sessionVersion?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({ message: 'Missing bearer token' });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (!payload.sub || !payload.email) {
        throw new UnauthorizedException({ message: 'Invalid token' });
      }

      const sessionVersion = payload.sessionVersion ?? 0;

      if (!Number.isInteger(sessionVersion)) {
        throw new UnauthorizedException({ message: 'Invalid token' });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { sessionVersion: true },
      });

      if (!user || user.sessionVersion !== sessionVersion) {
        throw new UnauthorizedException({ message: 'Invalid token' });
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ message: 'Invalid token' });
    }
  }

  private extractBearerToken(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
