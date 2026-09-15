import { IsString } from 'class-validator';

export class QuoteShippingDto {
  @IsString()
  province: string;
}
