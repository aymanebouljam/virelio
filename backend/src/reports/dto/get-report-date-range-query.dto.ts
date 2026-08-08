import { IsDateString, IsOptional } from 'class-validator';

export class GetReportDateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
