import { IsEmail, IsString } from 'class-validator';

export class CreateStockAlertDto {
  @IsString()
  productId: string;

  @IsEmail()
  buyerEmail: string;
}
