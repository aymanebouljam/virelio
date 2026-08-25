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

  beforeEach(() => {
    jest.resetAllMocks();
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
});
