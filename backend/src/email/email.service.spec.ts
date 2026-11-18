import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const crearServicio = (env: Record<string, string>) =>
  new EmailService({ get: (k: string) => env[k] } as unknown as ConfigService);

describe('EmailService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('simula el envío si EMAIL_HABILITADO no es true', async () => {
    const s = crearServicio({ BREVO_API_KEY: 'x' });
    await expect(s.enviar('a@b.com', 'Hola', 'texto')).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envía por Brevo con remitente, destinatario y html', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const s = crearServicio({
      EMAIL_HABILITADO: 'true',
      BREVO_API_KEY: 'clave-falsa',
      BREVO_SENDER_EMAIL: 'tienda@x.com',
    });

    await expect(s.enviar('cli@x.com', 'Asunto', 'texto', '<p>hola</p>')).resolves.toBe(true);

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(opts.headers['api-key']).toBe('clave-falsa');
    const body = JSON.parse(opts.body);
    expect(body.sender.email).toBe('tienda@x.com');
    expect(body.to).toEqual([{ email: 'cli@x.com' }]);
    expect(body.subject).toBe('Asunto');
    expect(body.htmlContent).toBe('<p>hola</p>');
  });

  it('usa EMAIL_USER como remitente si no hay BREVO_SENDER_EMAIL', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const s = crearServicio({
      EMAIL_HABILITADO: 'true',
      BREVO_API_KEY: 'k',
      EMAIL_USER: 'gmail@x.com',
    });
    await s.enviar('c@x.com', 'A', 'T');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).sender.email).toBe('gmail@x.com');
  });

  it('devuelve false si Brevo responde con error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    const s = crearServicio({ EMAIL_HABILITADO: 'true', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 't@x.com' });
    await expect(s.enviar('c@x.com', 'A', 'T')).resolves.toBe(false);
  });

  it('devuelve false si la llamada falla o vence el tiempo', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));
    const s = crearServicio({ EMAIL_HABILITADO: 'true', BREVO_API_KEY: 'k', BREVO_SENDER_EMAIL: 't@x.com' });
    await expect(s.enviar('c@x.com', 'A', 'T')).resolves.toBe(false);
  });

  it('devuelve false si no hay remitente configurado', async () => {
    const s = crearServicio({ EMAIL_HABILITADO: 'true', BREVO_API_KEY: 'k' });
    await expect(s.enviar('c@x.com', 'A', 'T')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
