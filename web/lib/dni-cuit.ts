// Valida un DNI (7-8 dígitos) o CUIT/CUIL (11 dígitos, con dígito
// verificador real) argentino. Ignora puntos, guiones y espacios que el
// usuario haya tipeado. Misma lógica que api/src/common/dni-cuit.ts.
export function normalizeDniCuit(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidCuitCheckDigit(digits: string): boolean {
  const mult = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const nums = digits.split('').map(Number);
  const sum = mult.reduce((acc, m, i) => acc + m * nums[i], 0);
  const checkDigit = 11 - (sum % 11);
  const expected = checkDigit === 11 ? 0 : checkDigit;
  return expected < 10 && expected === nums[10];
}

export function isValidDniOrCuit(value: string): boolean {
  const digits = normalizeDniCuit(value);
  if (digits.length === 7 || digits.length === 8) {
    return true;
  }
  if (digits.length === 11) {
    return isValidCuitCheckDigit(digits);
  }
  return false;
}
