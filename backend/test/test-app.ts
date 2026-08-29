import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Server } from 'node:http';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuthMailService,
  type AuthMailMessage,
} from '../src/auth/auth-mail.service';

export interface TestApp {
  app: NestExpressApplication;
  http: Server;
  prisma: PrismaService;
  authMailMessages: AuthMailMessage[];
}
export async function createTestApp(): Promise<TestApp> {
  const authMailMessages: AuthMailMessage[] = [];
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(AuthMailService)
    .useValue({
      send(message: AuthMailMessage) {
        authMailMessages.push(message);
        return Promise.resolve();
      },
    })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);

  await app.init();

  return {
    app,
    http: app.getHttpServer(),
    prisma: app.get(PrismaService),
    authMailMessages,
  };
}

export async function resetDatabase(prisma: PrismaService) {
  await prisma.proofDocument.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.recurringExpenseTemplate.deleteMany();
  await prisma.expenseCategory.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();
}
