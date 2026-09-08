export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
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
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Resend respondió ${res.status}: ${errorBody}`);
    }
  }
}