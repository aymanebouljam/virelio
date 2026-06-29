import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GetExpenseReportQueryDto } from './dto/get-expense-report-query.dto';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('expenses')
  getExpenseReport(@Query() query: GetExpenseReportQueryDto) {
    return this.reportsService.getExpenseReport(query);
  }
}
