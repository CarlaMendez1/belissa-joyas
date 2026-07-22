import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest'; 
import { AppModule } from '../app.module';

describe('Auth - Integración POST /auth/registro', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.enableCors({ origin: '*' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('debe registrar un usuario nuevo y retornar access_token', async () => {
    const email = `test.${Date.now()}@belissa.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ nombre: 'Test', apellido: 'Usuario', email, password: '123456' })
      .expect(201);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body.usuario.rol).toBe('cliente');
    expect(res.body.usuario.email).toBe(email);
  });

  it('debe retornar 409 si el email ya está registrado', async () => {
    const email = `duplicado.${Date.now()}@belissa.com`;
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ nombre: 'A', apellido: 'B', email, password: '123456' });

    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ nombre: 'A', apellido: 'B', email, password: '123456' })
      .expect(409);
  });

  it('debe retornar 400 si faltan campos requeridos', async () => {
    await request(app.getHttpServer())
      .post('/auth/registro')
      .send({ email: 'incompleto@belissa.com' })
      .expect(400);
  });
});