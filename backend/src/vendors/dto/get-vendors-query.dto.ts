import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetVendorsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
