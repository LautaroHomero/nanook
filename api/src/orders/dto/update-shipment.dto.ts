import { IsIn, IsOptional, IsString } from 'class-validator';

export const SHIPMENT_STATUSES = ['pending', 'preparing', 'shipped', 'delivered'] as const;

export class UpdateShipmentDto {
  @IsIn(SHIPMENT_STATUSES)
  status: (typeof SHIPMENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  note?: string;
}
