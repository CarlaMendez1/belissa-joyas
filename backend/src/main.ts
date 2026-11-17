import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import './common/zona-horaria.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  // En producción solo el frontend publicado puede llamar a la API (FRONTEND_URL);
  // sin esa variable (desarrollo) se permite cualquier origen.
  const frontendUrl = process.env.FRONTEND_URL?.replace(/\/$/, '');
  app.enableCors({
    origin: frontendUrl || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  });
  // Los servicios de hosting asignan el puerto en la variable PORT
  const puerto = Number(process.env.PORT) || 3001;
  await app.listen(puerto, '0.0.0.0');
  console.log(`Backend corriendo en el puerto ${puerto}`);
}
bootstrap();
