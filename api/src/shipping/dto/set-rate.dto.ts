import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class SetShippingRateDto {
  @IsNumber()
  @Min(0)
  costSucursal: number;

  @IsNumber()
  @Min(0)
  costDomicilio: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedDays?: number;
}
