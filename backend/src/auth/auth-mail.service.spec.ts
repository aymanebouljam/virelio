import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { AuthMailService } from './auth-mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

describe('AuthMailService', () => {
  const getOrThrowMock = jest.fn();
  const sendMailMock = jest.fn();
  const createTransportMock = nodemailer.createTransport as jest.Mock;
  const configService = {
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
        MAILTRAP_HOST: 'sandbox.smtp.mailtrap.io',
        MAILTRAP_PORT: '2525',
        MAILTRAP_USERNAME: 'mailtrap-user',
        MAILTRAP_PASSWORD: 'mailtrap-password',
        MAIL_FROM: 'Virelio <noreply@virelio.test>',
      };

      return values[key];
    });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    service = new AuthMailService(configService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends mail through the configured Mailtrap SMTP transport', async () => {
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
      host: 'sandbox.smtp.mailtrap.io',
      port: 2525,
      secure: false,
      auth: {
        user: 'mailtrap-user',
        pass: 'mailtrap-password',
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
