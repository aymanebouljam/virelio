import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
