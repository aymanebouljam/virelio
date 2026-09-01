import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { JwtUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(body);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  confirmPasswordReset(@Body() body: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(body);
  }

  @Post('email-verification/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  resendEmailVerification(@Body() body: ResendEmailVerificationDto) {
    return this.authService.resendEmailVerification(body);
  }

  @Post('email-verification/confirm')
  @HttpCode(HttpStatus.OK)
  confirmEmailVerification(@Body() body: ConfirmEmailVerificationDto) {
    return this.authService.confirmEmailVerification(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    return this.authService.updateProfile(user.sub, body);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @CurrentUser() user: JwtUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, body);
  }
}
