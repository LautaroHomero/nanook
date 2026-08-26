import { IsNumber, IsOptional, IsString } from 'class-validator';

export class QuoteShippingDto {
  @IsString()
  zip: string;

  @IsOptional()
  @IsNumber()
  weightKg?: number;
}
