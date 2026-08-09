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

export class CreateRecurringExpenseTemplateDto {
  @IsUUID('4')
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

  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @IsDateString()
  nextDueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
