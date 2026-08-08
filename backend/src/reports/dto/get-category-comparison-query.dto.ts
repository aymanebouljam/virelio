import { IsDateString } from 'class-validator';

export class GetCategoryComparisonQueryDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}
