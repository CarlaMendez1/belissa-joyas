import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { loadFeature, defineFeature } from 'jest-cucumber';
import { AppModule } from '../app.module';

const feature = loadFeature('./src/auth/features/registro.feature');

defineFeature(feature, (test) => {
  let app: INestApplication;
  let response: any;
  let emailUsado: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test('Registro exitoso con datos válidos', ({ given, when, then, and }) => {
    given('que tengo los datos de un usuario nuevo', () => {
      emailUsado = `nuevo.${Date.now()}@belissa.com`;
    });

    when('envío la solicitud de registro', async () => {
      response = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ nombre: 'María', apellido: 'González', email: emailUsado, password: 'segura123' });
    });

    then('debo recibir un token de acceso', () => {
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('access_token');
    });

    and('el usuario debe tener rol cliente', () => {
      expect(response.body.usuario.rol).toBe('cliente');
    });
  });

  test('Registro fallido por email duplicado', ({ given, when, then }) => {
    given('que ya existe un usuario registrado con ese email', async () => {
      emailUsado = `duplicado.${Date.now()}@belissa.com`;
      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ nombre: 'A', apellido: 'B', email: emailUsado, password: '123456' });
    });

    when('envío la solicitud de registro con el mismo email', async () => {
      response = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ nombre: 'A', apellido: 'B', email: emailUsado, password: '123456' });
    });

    then('debo recibir un error 409', () => {
      expect(response.status).toBe(409);
    });
  });

  test('Registro fallido por contraseña corta', ({ given, when, then }) => {
    given('que tengo los datos con contraseña menor a 6 caracteres', () => {
      emailUsado = `corta.${Date.now()}@belissa.com`;
    });

    when('envío la solicitud de registro', async () => {
      response = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({ nombre: 'Test', apellido: 'Test', email: emailUsado, password: '123' });
    });

    then('debo recibir un error 400', () => {
      expect(response.status).toBe(400);
    });
  });
});