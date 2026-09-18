import { PDFParse } from 'pdf-parse';

export interface BankDetailsForCheck {
  cbu: string;
  alias: string;
}

export interface ReceiptCheckResult {
  status: 'match' | 'mismatch';
  detail: string;
}

// Primer chequeo automático de un comprobante: ¿el PDF menciona el CBU/CVU
// o el alias de nuestra cuenta? No confirma que la plata haya llegado (eso
// lo sigue viendo el admin a mano en su banco) — solo detecta el caso más
// común de error o fraude: un comprobante de una transferencia a otra
// cuenta. Un PDF sin texto (foto/escaneo) también cuenta como "mismatch":
// no hay forma de validarlo automáticamente.
export async function checkReceiptAgainstBankDetails(
  pdfBuffer: Buffer,
  bank: BankDetailsForCheck,
): Promise<ReceiptCheckResult> {
  let text: string;
  try {
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const result = await parser.getText();
      text = result.text ?? '';
    } finally {
      await parser.destroy();
    }
  } catch {
    return { status: 'mismatch', detail: 'No pudimos leer el PDF del comprobante.' };
  }

  if (!text.trim()) {
    return {
      status: 'mismatch',
      detail: 'El PDF no tiene texto legible (¿es una foto o un escaneo?).',
    };
  }

  const textDigits = text.replace(/\D/g, '');
  const cbuDigits = bank.cbu.replace(/\D/g, '');
  const cbuMatches = cbuDigits.length > 0 && textDigits.includes(cbuDigits);

  const aliasNormalized = bank.alias.trim().toLowerCase();
  const aliasMatches = aliasNormalized.length > 0 && text.toLowerCase().includes(aliasNormalized);

  if (cbuMatches || aliasMatches) {
    return {
      status: 'match',
      detail: cbuMatches
        ? 'El CBU/CVU del comprobante coincide con nuestra cuenta.'
        : 'El alias del comprobante coincide con nuestra cuenta.',
    };
  }

  return {
    status: 'mismatch',
    detail: 'No encontramos nuestro CBU/CVU ni el alias en el texto del comprobante.',
  };
}
