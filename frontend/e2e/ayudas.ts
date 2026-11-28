import { expect, type Page } from '@playwright/test';
import { password } from './datos';

export async function iniciarSesion(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

export async function iniciarSesionComoClienta(page: Page, email: string) {
  await iniciarSesion(page, email);
  await expect(page).toHaveURL('http://localhost:3000/');
}

import { Client } from 'pg';

/** Consulta directa a la base de prueba, para verificar lo que el sitio no muestra (stock, estados). */
export async function consultar<T = Record<string, unknown>>(sql: string, valores: unknown[] = []): Promise<T[]> {
  const db = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'belissa_test',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? '',
  });
  await db.connect();
  try {
    return (await db.query(sql, valores)).rows as T[];
  } finally {
    await db.end();
  }
}

export const stockDe = async (sku: string) =>
  Number((await consultar<{ stock_disponible: number }>(`SELECT stock_disponible FROM variante WHERE codigo_sku = $1`, [sku]))[0].stock_disponible);
