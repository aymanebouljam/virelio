import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecurringExpenseTemplatesController } from './recurring-expense-templates.controller';
import { RecurringExpenseTemplatesService } from './recurring-expense-templates.service';

@Module({
  imports: [AuthModule],
  controllers: [RecurringExpenseTemplatesController],
  providers: [RecurringExpenseTemplatesService],
  exports: [RecurringExpenseTemplatesService],
})
export class RecurringExpenseTemplatesModule {}
