import { armarCorreoHtml, COLORES_CORREO, escaparHtml } from './plantilla-email';

describe('plantilla de correos', () => {
  const html = armarCorreoHtml({
    saludo: 'Hola Lucía,',
    parrafos: ['Tu pedido ya fue despachado.'],
    datos: [{ etiqueta: 'Transportista', valor: 'Correo Argentino' }],
    productos: [{ nombre: 'Collar Luna', cantidad: 2 }],
    boton: { texto: 'Volver a la tienda', url: 'https://belissa-joyas.vercel.app' },
    pie: 'Gracias por elegir Belissa Joyas.',
  });

  it('usa la paleta de la tienda', () => {
    expect(html).toContain(COLORES_CORREO.espressoBrown);
    expect(html).toContain(COLORES_CORREO.milk);
    expect(html).toContain(COLORES_CORREO.blushOat);
    expect(html).toContain(COLORES_CORREO.dustyRose);
  });

  it('no usa tonos naranjas ni ámbar', () => {
    expect(html.toLowerCase()).not.toMatch(/#b45309|#92400e|#f97316|#ea580c|orange|amber/);
  });

  it('incluye encabezado, saludo, datos, productos, botón y pie', () => {
    expect(html).toContain('Belissa Joyas');
    expect(html).toContain('Hola Lucía,');
    expect(html).toContain('Correo Argentino');
    expect(html).toContain('Collar Luna');
    expect(html).toContain('x2');
    expect(html).toContain('href="https://belissa-joyas.vercel.app"');
    expect(html).toContain('Gracias por elegir Belissa Joyas.');
  });

  it('escapa el HTML de los datos que escribe el usuario', () => {
    const peligroso = armarCorreoHtml({ saludo: 'Hola <script>alert(1)</script>,', parrafos: [] });
    expect(peligroso).not.toContain('<script>');
    expect(peligroso).toContain('&lt;script&gt;');
    expect(escaparHtml('a & "b"')).toBe('a &amp; &quot;b&quot;');
  });

  it('omite las secciones que no se piden', () => {
    const simple = armarCorreoHtml({ saludo: 'Hola', parrafos: ['Texto'] });
    expect(simple).not.toContain('<table');
    expect(simple).not.toContain('<a href');
  });
});
