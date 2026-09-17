import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

export class AddStockDto {
  // Un número de serie por unidad que se agrega al stock.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  serialNumbers: string[];
}
