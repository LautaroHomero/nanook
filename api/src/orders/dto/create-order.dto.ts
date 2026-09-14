import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const SHIPPING_METHODS = ['SUCURSAL', 'DOMICILIO'] as const;

export class OrderItemInput {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInput)
  items: OrderItemInput[];

  @IsString()
  buyerName: string;

  @IsEmail()
  buyerEmail: string;

  @IsString()
  buyerPhone: string;

  @IsString()
  shippingStreet: string;

  @IsString()
  shippingNumber: string;

  @IsString()
  shippingCity: string;

  @IsString()
  shippingState: string;

  @IsString()
  shippingZip: string;

  @IsIn(SHIPPING_METHODS)
  shippingMethod: (typeof SHIPPING_METHODS)[number];
}
