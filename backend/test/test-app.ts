import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { Server } from 'node:http';
import { PrismaService } from '../prisma/prisma.service';

export interface TestApp {
  app: NestExpressApplication;
  http: Server;
  prisma: PrismaService;
}
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);

  await app.init();

  return {
    app,
    http: app.getHttpServer(),
    prisma: app.get(PrismaService),
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
