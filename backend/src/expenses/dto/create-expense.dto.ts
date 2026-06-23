import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsUUID('4')
  @IsNotEmpty()
  vendorId!: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
