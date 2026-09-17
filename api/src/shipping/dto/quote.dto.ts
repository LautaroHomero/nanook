import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QuoteShippingDto {
  @IsString()
  province: string;

  // Partido de destino (solo relevante dentro de la provincia de Buenos
  // Aires: separa AMBA/Gran La Plata del resto de la provincia).
  @IsOptional()
  @IsString()
  partido?: string;

  // Subtotal de productos del carrito (sin envío), para saber si aplica
  // envío gratis. Opcional para no romper llamadas viejas al endpoint.
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemsTotal?: number;
}
