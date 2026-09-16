export interface EmailAttachment {
  filename: string;
  // Contenido en base64. Lo armamos nosotros (bajando el archivo de donde
  // esté guardado) para que llegue como adjunto real del mail, no como un
  // link que depende de que esa URL sea pública y siga viva.
  content: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export interface NotificationProvider {
  sendEmail(input: SendEmailInput): Promise<void>;
}

// Mock: no manda nada de verdad, solo lo deja logueado en consola del
// contenedor `api`. Sirve para probar todo el flujo (pedido → vínculo →
// "aviso") sin tener una cuenta de email transaccional todavía.
// Cuando quieras mails reales, escribís una clase que implemente
// NotificationProvider usando Resend/SendGrid/Nodemailer y la instanciás en
// notifications.service.ts en vez de esta — nada más cambia.
export class MockNotificationProvider implements NotificationProvider {
  async sendEmail(input: SendEmailInput): Promise<void> {
    console.log('--- 📧 Notificación (mock) ---');
    console.log(`Para: ${input.to}`);
    console.log(`Asunto: ${input.subject}`);
    console.log(input.body);
    if (input.attachments?.length) {
      console.log(`Adjuntos: ${input.attachments.map((a) => a.filename).join(', ')}`);
    }
    console.log('-------------------------------');
  }
}

// Manda mails de verdad vía la API HTTP de Resend (resend.com).
export class ResendNotificationProvider implements NotificationProvider {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async sendEmail(input: SendEmailInput): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.content,
              })),
            }
          : {}),
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${errorBody}`);
    }
  }
}