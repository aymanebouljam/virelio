import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

export type AuthMailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class AuthMailService {
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

    return transporter.sendMail({
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      ...message,
    });
  }
}
