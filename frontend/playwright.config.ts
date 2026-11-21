import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Pruebas de punta a punta: levantan el backend (NestJS) y el frontend (Next.js)
 * contra una base PostgreSQL de PRUEBA y manejan el sitio con un navegador real.
 *
 * Variables de la base de prueba (las mismas que usan las pruebas de integración
 * del backend): DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS.
 */
// Mismo sufijo en la preparación y en los workers (los correos deben coincidir)
process.env.E2E_SUFIJO ??= String(Date.now());

const db = {
  DB_HOST: process.env.DB_HOST ?? 'localhost',
  DB_PORT: process.env.DB_PORT ?? '5432',
  DB_NAME: process.env.DB_NAME ?? 'belissa_test',
  DB_USER: process.env.DB_USER ?? 'postgres',
  DB_PASS: process.env.DB_PASS ?? '',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'es-AR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start',
      cwd: '../backend',
      url: 'http://localhost:3001/categorias',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...db,
        JWT_SECRET: 'e2e-secret',
        EMAIL_HABILITADO: 'false',
        BREVO_API_KEY: '',
        MP_ACCESS_TOKEN: 'simulado',
        FRONTEND_URL: 'http://localhost:3000',
        BACKEND_PUBLIC_URL: 'http://localhost:3001',
        // Mercado Pago simulado: nunca se cobra de verdad
        NODE_OPTIONS: `--require ${path.resolve(__dirname, 'e2e/mp-simulado.cjs')}`,
      } as Record<string, string>,
    },
    {
      command: 'npm run dev -- -p 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://localhost:3001',
        NEXTAUTH_URL: 'http://localhost:3000',
        NEXTAUTH_SECRET: 'e2e-nextauth-secret',
        GOOGLE_CLIENT_ID: 'e2e',
        GOOGLE_CLIENT_SECRET: 'e2e',
      },
    },
  ],
});
