import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Traduce errores de PostgreSQL (unique, check, triggers) a respuestas HTTP claras.
// La BD es la que garantiza las reglas; esto solo mejora el mensaje.
export function traducirErrorBD(error: unknown, mensajes: Record<string, string> = {}): never {
  if (error instanceof QueryFailedError) {
    const driver = error.driverError as { code?: string; constraint?: string; message?: string };
    const mensaje = driver.constraint ? mensajes[driver.constraint] : undefined;
    if (driver.code === '23505') {
      throw new ConflictException(mensaje ?? 'Ya existe un registro con esos datos');
    }
    if (driver.code === '23514') {
      throw new BadRequestException(mensaje ?? driver.message ?? 'Los datos no cumplen las reglas de validación');
    }
  }
  throw error;
}

// Quita espacios de los extremos y colapsa los repetidos del interior.
export function normalizarTexto(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}