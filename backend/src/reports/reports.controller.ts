import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetExpenseReportQueryDto } from './dto/get-expense-report-query.dto';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/auth.types';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('expenses')
  getExpenseReport(
    @CurrentUser() user: JwtUser,
    @Query() query: GetExpenseReportQueryDto,
  ) {
    return this.reportsService.getExpenseReport(user.sub, query);
  }
}
