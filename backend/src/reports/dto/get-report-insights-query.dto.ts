import { IsDateString, IsOptional } from 'class-validator';

export class GetReportInsightsQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
