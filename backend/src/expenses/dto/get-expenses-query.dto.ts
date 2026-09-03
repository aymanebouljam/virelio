import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GetExpensesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  search?: string;

  @IsOptional()
  @IsUUID('4')
  vendorId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsIn(['missing'])
  proofStatus?: 'missing';

  @IsOptional()
  @IsIn(['missing'])
  categoryStatus?: 'missing';

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
