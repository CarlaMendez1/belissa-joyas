import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private habilitado: boolean;

  constructor(private readonly configService: ConfigService) {
    this.habilitado = this.configService.get<string>('EMAIL_HABILITADO') === 'true';

    if (this.habilitado) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASS'),
        },
      });
    }
  }

  async enviar(destinatario: string, asunto: string, contenido: string): Promise<boolean> {
    if (!this.habilitado || !this.transporter) {
      this.logger.log(`📧 [SIMULADO] Email a ${destinatario} — Asunto: ${asunto}\n${contenido}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: `"Belissa Joyas" <${this.configService.get<string>('EMAIL_USER')}>`,
        to: destinatario,
        subject: asunto,
        text: contenido,
      });
      this.logger.log(`Email enviado correctamente a ${destinatario}`);
      return true;
    } catch (err) {
      this.logger.error(`Error al enviar email a ${destinatario}`, err as Error);
      return false;
    }
  }
}