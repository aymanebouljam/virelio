import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VendorsModule } from './vendors/vendors.module';
import { ExpenseCategoriesModule } from './categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ProofsModule } from './proofs/proofs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    VendorsModule,
    ExpenseCategoriesModule,
    ExpensesModule,
    ProofsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
