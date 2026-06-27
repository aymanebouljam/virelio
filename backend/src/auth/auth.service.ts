import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

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
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
        updatedAt: true,
      },
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

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
