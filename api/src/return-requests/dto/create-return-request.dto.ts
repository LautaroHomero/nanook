import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from 'class-validator';

export class CreateReturnRequestDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orderNumber: number;

  @IsEmail()
  buyerEmail: string;

  @IsString()
  @MinLength(10)
  reason: string;

  // Vienen de subir la foto vía /uploads/return-photos (que devuelve URLs de
  // Cloudinary), pero como este endpoint es público, no confiamos en el
  // string a ciegas: validamos que sea una URL http(s) real antes de
  // guardarla o de insertarla en el mail al admin.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: false },
    { each: true },
  )
  images?: string[];
}
