import {
  CanActivate,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { JwtUser } from './auth.types';

type AuthenticatedRequest = Request & {
  user?: JwtUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({ message: 'Missing bearer token' });
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtUser>(token);

      if (!payload.sub || !payload.email) {
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
