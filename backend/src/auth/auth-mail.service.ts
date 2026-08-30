import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type AuthMailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const MAX_SEND_ATTEMPTS = 3;

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(message: AuthMailMessage) {
    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAILTRAP_HOST'),
      port: Number(this.configService.getOrThrow<string>('MAILTRAP_PORT')),
      secure: false,
      auth: {
        user: this.configService.getOrThrow<string>('MAILTRAP_USERNAME'),
        pass: this.configService.getOrThrow<string>('MAILTRAP_PASSWORD'),
      },
    });

    const mail = {
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      ...message,
    };
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
      try {
        return await transporter.sendMail(mail);
      } catch (error) {
        lastError = error;

        if (attempt < MAX_SEND_ATTEMPTS) {
          this.logger.warn(
            `Authentication email delivery failed; retrying (${attempt}/${MAX_SEND_ATTEMPTS})`,
          );
        }
      }
    }

    this.logger.error(
      `Authentication email delivery failed after ${MAX_SEND_ATTEMPTS} attempts`,
      lastError instanceof Error ? lastError.stack : undefined,
    );
    throw lastError;
  }
}
