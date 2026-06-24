import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetDashboardSummaryQueryDto } from './dto/get-dashboard-summary-query.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query() query: GetDashboardSummaryQueryDto) {
    return this.dashboardService.getSummary(query);
  }
}
