import {
  IsNotEmpty,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidDniOrCuit } from '../../common/dni-cuit';

@ValidatorConstraint({ name: 'isDniOrCuit', async: false })
class IsDniOrCuitConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return typeof value === 'string' && isValidDniOrCuit(value);
  }
  defaultMessage() {
    return 'CUIT/DNI del titular inválido: verificá que esté bien escrito';
  }
}

export class UpdateBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  // CBU o CVU: siempre 22 dígitos.
  @Matches(/^\d{22}$/, { message: 'El CBU/CVU tiene que tener 22 dígitos' })
  cbu: string;

  // Alias bancario: 6 a 20 caracteres, letras/números/puntos/guiones.
  @Matches(/^[a-zA-Z0-9.-]{6,20}$/, {
    message: 'El alias tiene que tener entre 6 y 20 caracteres (letras, números, puntos o guiones)',
  })
  alias: string;

  @IsString()
  @IsNotEmpty()
  holderName: string;

  @Validate(IsDniOrCuitConstraint)
  holderCuit: string;
}
