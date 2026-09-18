import { IsUrl } from 'class-validator';

export class AttachTransferReceiptDto {
  // Viene de subir el archivo vía /uploads/transfer-receipt (que devuelve una
  // URL de Cloudinary), pero como este endpoint es público no confiamos en el
  // string a ciegas: validamos que sea una URL http(s) real.
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  receiptUrl: string;
}
