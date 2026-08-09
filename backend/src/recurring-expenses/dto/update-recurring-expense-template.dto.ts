import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { RecurrenceFrequency } from '../../../generated/prisma/client';

export class UpdateRecurringExpenseTemplateDto {
  @IsOptional()
  @IsUUID('4')
  vendorId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  frequency?: RecurrenceFrequency;

  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
