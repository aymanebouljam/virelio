import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { throwPrismaConflict } from '../common/prisma/prisma-error.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
}
