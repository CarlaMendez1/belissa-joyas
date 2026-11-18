import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 10000;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private habilitado: boolean;
  private brevoApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.habilitado = this.configService.get<string>('EMAIL_HABILITADO') === 'true';
    this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY') || undefined;

    // Brevo (HTTPS) tiene prioridad. Gmail SMTP queda como alternativa
    // para entornos donde los puertos SMTP no están bloqueados.
    if (this.habilitado && !this.brevoApiKey) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASS'),
        },
      });
    }
  }

  async enviar(destinatario: string, asunto: string, contenido: string, html?: string): Promise<boolean> {
    if (!this.habilitado) {
      this.logger.log(`📧 [SIMULADO] Email a ${destinatario} — Asunto: ${asunto}\n${contenido}`);
      return true;
    }

    if (this.brevoApiKey) {
      return this.enviarConBrevo(destinatario, asunto, contenido, html);
    }

    if (!this.transporter) {
      this.logger.log(`📧 [SIMULADO] Email a ${destinatario} — Asunto: ${asunto}\n${contenido}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Belissa Joyas" <${this.configService.get<string>('EMAIL_USER')}>`,
        to: destinatario,
        subject: asunto,
        text: contenido,
        ...(html ? { html } : {}),
      });
      this.logger.log(`Email enviado correctamente a ${destinatario}`);
      return true;
    } catch (err) {
      this.logger.error(`Error al enviar email a ${destinatario}`, err as Error);
      return false;
    }
  }

  private async enviarConBrevo(
    destinatario: string,
    asunto: string,
    contenido: string,
    html?: string,
  ): Promise<boolean> {
    const remitente =
      this.configService.get<string>('BREVO_SENDER_EMAIL') ||
      this.configService.get<string>('EMAIL_USER');

    if (!remitente) {
      this.logger.error('Brevo: falta BREVO_SENDER_EMAIL (o EMAIL_USER); no se envió el email');
      return false;
    }

    try {
      const respuesta = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey as string,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Belissa Joyas', email: remitente },
          to: [{ email: destinatario }],
          subject: asunto,
          textContent: contenido,
          ...(html ? { htmlContent: html } : {}),
        }),
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        this.logger.error(`Brevo respondió ${respuesta.status} al enviar a ${destinatario}: ${detalle}`);
        return false;
      }

      this.logger.log(`Email enviado correctamente a ${destinatario} (Brevo)`);
      return true;
    } catch (err) {
      this.logger.error(`Error al enviar email a ${destinatario} (Brevo)`, err as Error);
      return false;
    }
  }
}
