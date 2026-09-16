import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateReturnRequestDto {
  @IsString()
  orderId: string;

  @IsEmail()
  buyerEmail: string;

  @IsString()
  @MinLength(10)
  reason: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}
