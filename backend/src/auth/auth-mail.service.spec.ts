import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appendFile, mkdir } from 'node:fs/promises';
import nodemailer from 'nodemailer';
import { AuthMailService } from './auth-mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

jest.mock('node:fs/promises', () => ({
  appendFile: jest.fn(),
  mkdir: jest.fn(),
}));

describe('AuthMailService', () => {
  const getOrThrowMock = jest.fn();
  const getMock = jest.fn();
  const sendMailMock = jest.fn();
  const appendFileMock = appendFile as jest.Mock;
  const mkdirMock = mkdir as jest.Mock;
  const createTransportMock = nodemailer.createTransport as jest.Mock;
  const configService = {
    get: getMock,
    getOrThrow: getOrThrowMock,
  } as unknown as ConfigService;

  let service: AuthMailService;
  let warnMock: jest.SpiedFunction<Logger['warn']>;
  let errorMock: jest.SpiedFunction<Logger['error']>;

  beforeEach(() => {
    jest.resetAllMocks();
    warnMock = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorMock = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    getOrThrowMock.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        AUTH_MAIL_LOG_PATH: './.local/auth-emails.log',
        MAIL_HOST: 'smtp.example.com',
        MAIL_PORT: '587',
        MAIL_USERNAME: 'smtp-user',
        MAIL_PASSWORD: 'smtp-password',
        MAIL_FROM: 'Virelio <noreply@virelio.test>',
      };

      return values[key];
    });
    getMock.mockReturnValue(undefined);
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    service = new AuthMailService(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends mail through the configured SMTP transport', async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: 'message-1' });

    await expect(
      service.send({
        to: 'owner@example.com',
        subject: 'Verify your email',
        text: 'Verification text',
        html: '<p>Verification text</p>',
      }),
    ).resolves.toEqual({ messageId: 'message-1' });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    });
    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'Virelio <noreply@virelio.test>',
      to: 'owner@example.com',
      subject: 'Verify your email',
      text: 'Verification text',
      html: '<p>Verification text</p>',
    });
  });

  it('writes mail to the configured local file transport', async () => {
    getMock.mockImplementation((key: string) => {
      if (key === 'AUTH_MAIL_TRANSPORT') {
        return 'file';
      }

      return undefined;
    });
    mkdirMock.mockResolvedValueOnce(undefined);
    appendFileMock.mockResolvedValueOnce(undefined);

    await expect(
      service.send({
        to: 'owner@example.com',
        subject: 'Verify your email',
        text: 'Verification text',
        html: '<p>Verification text</p>',
      }),
    ).resolves.toEqual({ messageId: 'local-file' });

    expect(createTransportMock).not.toHaveBeenCalled();
    expect(mkdirMock).toHaveBeenCalledWith('./.local', { recursive: true });
    expect(appendFileMock).toHaveBeenCalledWith(
      './.local/auth-emails.log',
      expect.stringContaining(
        'To: owner@example.com\nSubject: Verify your email',
      ),
      'utf8',
    );
  });

  it('retries a failed send and returns the next successful result', async () => {
    const deliveryError = new Error('Temporary SMTP failure');
    sendMailMock
      .mockRejectedValueOnce(deliveryError)
      .mockResolvedValueOnce({ messageId: 'message-1' });

    await expect(
      service.send({
        to: 'owner@example.com',
        subject: 'Verify your email',
        text: 'Verification text',
        html: '<p>Verification text</p>',
      }),
    ).resolves.toEqual({ messageId: 'message-1' });

    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(warnMock).toHaveBeenCalledWith(
      'Authentication email delivery failed; retrying (1/3)',
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('logs and rethrows the final error after all send attempts fail', async () => {
    const deliveryError = new Error('SMTP unavailable');
    sendMailMock.mockRejectedValue(deliveryError);

    await expect(
      service.send({
        to: 'owner@example.com',
        subject: 'Verify your email',
        text: 'Verification text',
        html: '<p>Verification text</p>',
      }),
    ).rejects.toBe(deliveryError);

    expect(sendMailMock).toHaveBeenCalledTimes(3);
    expect(warnMock).toHaveBeenNthCalledWith(
      1,
      'Authentication email delivery failed; retrying (1/3)',
    );
    expect(warnMock).toHaveBeenNthCalledWith(
      2,
      'Authentication email delivery failed; retrying (2/3)',
    );
    expect(errorMock).toHaveBeenCalledWith(
      'Authentication email delivery failed after 3 attempts',
      deliveryError.stack,
    );
  });
});
