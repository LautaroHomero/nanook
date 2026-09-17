import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidDniOrCuit } from '../../common/dni-cuit';

export const SHIPPING_METHODS = ['SUCURSAL', 'DOMICILIO'] as const;

@ValidatorConstraint({ name: 'isDniOrCuit', async: false })
class IsDniOrCuitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidDniOrCuit(value);
  }
  defaultMessage() {
    return 'DNI o CUIT inválido: verificá que esté bien escrito';
  }
}

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
  @Validate(IsDniOrCuitConstraint)
  buyerDni: string;

  @IsString()
  shippingStreet: string;

  @IsString()
  shippingNumber: string;

  @IsString()
  shippingCity: string;

  @IsString()
  shippingState: string;

  // Partido de destino (solo relevante dentro de la provincia de Buenos
  // Aires: separa AMBA/Gran La Plata del resto de la provincia al
  // calcular el costo de envío). Opcional para no romper clientes viejos.
  @IsOptional()
  @IsString()
  shippingPartido?: string;

  @IsString()
  shippingZip: string;

  @IsIn(SHIPPING_METHODS)
  shippingMethod: (typeof SHIPPING_METHODS)[number];
}
