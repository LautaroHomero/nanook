import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QuoteShippingDto {
  @IsString()
  province: string;

  // Subtotal de productos del carrito (sin envío), para saber si aplica
  // envío gratis. Opcional para no romper llamadas viejas al endpoint.
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemsTotal?: number;
}
