This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Pruebas de punta a punta (Playwright)

Manejan el sitio con un navegador real: registro e inicio de sesión, catálogo, favoritos, carrito y panel de administración. Levantan solas el backend y el frontend y necesitan una base PostgreSQL **de prueba** (nunca la de producción), con las mismas variables que las pruebas de integración del backend:

```bash
npx playwright install chromium        # una sola vez
DB_HOST=localhost DB_PORT=5432 DB_NAME=belissa_test DB_USER=postgres DB_PASS=... npm run test:e2e
```

Antes de correr, el backend debe poder compilar (`cd ../backend && npm install`). Cada corrida crea sus propios usuarios y su producto con un sufijo único, por lo que se puede repetir.
