import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { GetExpenseReportQueryDto } from './dto/get-expense-report-query.dto';
import { GetReportInsightsQueryDto } from './dto/get-report-insights-query.dto';
import { GetReportDateRangeQueryDto } from './dto/get-report-date-range-query.dto';
import { GetCategoryComparisonQueryDto } from './dto/get-category-comparison-query.dto';
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

  @Get('expenses.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="virelio-expenses.csv"')
  exportExpensesCsv(
    @CurrentUser() user: JwtUser,
    @Query() query: GetReportDateRangeQueryDto,
  ) {
    return this.reportsService.exportExpensesCsv(user.sub, query);
  }

  @Get('category-comparison')
  getCategoryComparison(
    @CurrentUser() user: JwtUser,
    @Query() query: GetCategoryComparisonQueryDto,
  ) {
    return this.reportsService.getCategoryComparison(user.sub, query);
  }

  @Get('insights')
  getReportInsights(
    @CurrentUser() user: JwtUser,
    @Query() query: GetReportInsightsQueryDto,
  ) {
    return this.reportsService.getReportInsights(user.sub, query);
  }
}
