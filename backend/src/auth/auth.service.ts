import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuthTokenType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { throwPrismaConflict } from '../common/prisma/prisma-error.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { AuthMailService } from './auth-mail.service';

const AUTH_TOKEN_TTL_MS = 60 * 60 * 1000;
const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';
const GENERIC_VERIFICATION_MESSAGE =
  'If an account exists for that email, a verification link has been sent.';

const userProfileSelect: Prisma.UserSelect = {
  id: true,
  email: true,
  fullName: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authMailService: AuthMailService,
    private readonly configService: ConfigService,
  ) {}

  async register(body: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException({
        message: 'User already exists',
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    return this.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        fullName: body.fullName,
      },
      select: userProfileSelect,
    });
  }

  async login(body: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: body.email,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = await bcrypt.compare(
      body.password,
      user.passwordHash,
    );

    if (!isValidPassword) {
      throw new UnauthorizedException({
        message: 'Invalid credentials',
      });
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    return {
      accessToken,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async requestPasswordReset(body: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true },
    });

    if (!user) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const token = await this.createAuthToken(user.id, 'PASSWORD_RESET');
    await this.authMailService.send({
      to: user.email,
      subject: 'Reset your Virelio password',
      text: `Reset your password: ${this.createFrontendUrl('/reset-password', token)}`,
      html: `<p>Reset your password: <a href="${this.createFrontendUrl('/reset-password', token)}">Reset password</a></p>`,
    });

    return { message: GENERIC_RESET_MESSAGE };
  }

  async confirmPasswordReset(body: ConfirmPasswordResetDto) {
    const authToken = await this.findValidAuthToken(
      body.token,
      'PASSWORD_RESET',
    );
    const passwordHash = await bcrypt.hash(body.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.delete({ where: { id: authToken.id } }),
    ]);

    return { message: 'Password reset successfully' };
  }

  async resendEmailVerification(body: ResendEmailVerificationDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, emailVerifiedAt: true },
    });

    if (!user || user.emailVerifiedAt) {
      return { message: GENERIC_VERIFICATION_MESSAGE };
    }

    await this.sendEmailVerification(user);
    return { message: GENERIC_VERIFICATION_MESSAGE };
  }

  async confirmEmailVerification(body: ConfirmEmailVerificationDto) {
    const authToken = await this.findValidAuthToken(
      body.token,
      'EMAIL_VERIFICATION',
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.authToken.delete({ where: { id: authToken.id } }),
    ]);

    return { message: 'Email verified successfully' };
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: userProfileSelect,
    });
  }

  async updateProfile(userId: string, body: UpdateProfileDto) {
    if (Object.values(body).every((value) => value === undefined)) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          {
            field: 'body',
            constraints: {
              isNotEmpty: 'Update body cannot be empty',
            },
          },
        ],
      });
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: body,
        select: userProfileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throwPrismaConflict(error, 'user');
      }
      throw error;
    }
  }

  async sendEmailVerification(user: { id: string; email: string }) {
    const token = await this.createAuthToken(user.id, 'EMAIL_VERIFICATION');
    await this.authMailService.send({
      to: user.email,
      subject: 'Verify your Virelio email',
      text: `Verify your email: ${this.createFrontendUrl('/verify-email', token)}`,
      html: `<p>Verify your email: <a href="${this.createFrontendUrl('/verify-email', token)}">Verify email</a></p>`,
    });
  }

  private async createAuthToken(userId: string, type: AuthTokenType) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date(Date.now() + AUTH_TOKEN_TTL_MS);

    await this.prisma.authToken.upsert({
      where: {
        userId_type: { userId, type },
      },
      create: {
        userId,
        tokenHash,
        type,
        expiresAt,
      },
      update: {
        tokenHash,
        expiresAt,
      },
    });

    return token;
  }

  private async findValidAuthToken(token: string, type: AuthTokenType) {
    const authToken = await this.prisma.authToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });

    if (
      !authToken ||
      authToken.type !== type ||
      authToken.expiresAt <= new Date()
    ) {
      throw new BadRequestException({
        message: 'This link is invalid or has expired',
      });
    }

    return authToken;
  }

  private createFrontendUrl(pathname: string, token: string) {
    const url = new URL(
      pathname,
      this.configService.getOrThrow<string>('AUTH_APP_URL'),
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
