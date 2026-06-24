import { IsDateString, IsOptional } from 'class-validator';

export class GetDashboardSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
