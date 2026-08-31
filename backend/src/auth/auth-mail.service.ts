import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import nodemailer from 'nodemailer';

export type AuthMailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const MAX_SEND_ATTEMPTS = 3;
const LOCAL_FILE_TRANSPORT = 'file';

type Mail = AuthMailMessage & {
  from: string;
};

@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly configService: ConfigService) {}

  async send(message: AuthMailMessage) {
    const mail = {
      from: this.configService.getOrThrow<string>('MAIL_FROM'),
      ...message,
    };

    if (
      this.configService.get<string>('AUTH_MAIL_TRANSPORT') ===
      LOCAL_FILE_TRANSPORT
    ) {
      return this.writeToLocalFile(mail);
    }

    const transporter = nodemailer.createTransport({
      host: this.configService.getOrThrow<string>('MAIL_HOST'),
      port: Number(this.configService.getOrThrow<string>('MAIL_PORT')),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.getOrThrow<string>('MAIL_USERNAME'),
        pass: this.configService.getOrThrow<string>('MAIL_PASSWORD'),
      },
    });

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

  private async writeToLocalFile(mail: Mail) {
    const logPath = this.configService.getOrThrow<string>('AUTH_MAIL_LOG_PATH');
    const content = [
      `From: ${mail.from}`,
      `To: ${mail.to}`,
      `Subject: ${mail.subject}`,
      '',
      mail.text,
      '',
      '---',
      '',
    ].join('\n');

    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, content, 'utf8');

    return { messageId: 'local-file' };
  }
}
