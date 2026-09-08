import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateProductRequestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEmail()
  buyerEmail: string;

  @IsOptional()
  @IsString()
  buyerPhone?: string;
}