import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export const SHIPMENT_STATUSES = ['pending', 'preparing', 'shipped', 'delivered'] as const;

export class UpdateShipmentDto {
  @IsIn(SHIPMENT_STATUSES)
  status: (typeof SHIPMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  trackingId?: string;

  // Números de serie de las unidades que efectivamente salieron en este
  // envío (uno por unidad, cargados previamente al ingresar el stock).
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  serialNumbers?: string[];
}
