/**
 * Plantilla única de los correos de Belissa Joyas.
 * Usa la paleta de la tienda (la misma de frontend/src/app/globals.css),
 * así todos los correos comparten formato y color.
 */
export const COLORES_CORREO = {
  milk: '#FBF7F4', // fondo general
  blushOat: '#E8D8CE', // bordes y separadores
  dustyRose: '#B98F88', // acento
  cocoaTaupe: '#7A6258', // texto secundario
  espressoBrown: '#3B2F2A', // encabezado, texto principal y botón
  blanco: '#FFFFFF',
} as const;

const FUENTE = "Georgia, 'Times New Roman', serif";

export interface DatoCorreo {
  etiqueta: string;
  valor: string;
}

export interface OpcionesCorreo {
  saludo: string;
  /** Párrafos de texto, en orden. */
  parrafos: string[];
  /** Filas "etiqueta / valor" (por ejemplo: transportista, seguimiento). */
  datos?: DatoCorreo[];
  /** Filas de producto: nombre a la izquierda, cantidad a la derecha. */
  productos?: { nombre: string; cantidad: number }[];
  boton?: { texto: string; url: string };
  pie?: string;
}

export function escaparHtml(texto: string): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function armarCorreoHtml(op: OpcionesCorreo): string {
  const c = COLORES_CORREO;

  const parrafos = op.parrafos
    .map(
      (p) =>
        `<p style="color: ${c.espressoBrown}; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">${escaparHtml(p)}</p>`,
    )
    .join('');

  const filas = (contenidoIzq: string, contenidoDer: string) => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid ${c.blushOat}; color: ${c.cocoaTaupe}; font-size: 14px;">${contenidoIzq}</td>
          <td style="padding: 12px 0; border-bottom: 1px solid ${c.blushOat}; color: ${c.espressoBrown}; font-size: 14px; text-align: right;">${contenidoDer}</td>
        </tr>`;

  const tablaDatos = op.datos?.length
    ? `<table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">${op.datos
        .map((d) => filas(escaparHtml(d.etiqueta), escaparHtml(d.valor)))
        .join('')}</table>`
    : '';

  const tablaProductos = op.productos?.length
    ? `<table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">${op.productos
        .map((p) => filas(escaparHtml(p.nombre), `x${p.cantidad}`))
        .join('')}</table>`
    : '';

  const boton = op.boton
    ? `<div style="text-align: center; margin: 28px 0 8px;">
        <a href="${escaparHtml(op.boton.url)}"
           style="background-color: ${c.espressoBrown}; color: ${c.milk}; text-decoration: none; padding: 12px 32px; border-radius: 999px; font-size: 14px; display: inline-block;">
          ${escaparHtml(op.boton.texto)}
        </a>
      </div>`
    : '';

  const pie = op.pie
    ? `<p style="color: ${c.cocoaTaupe}; font-size: 12px; text-align: center; margin: 20px 0 0;">${escaparHtml(op.pie)}</p>`
    : '';

  return `
    <div style="font-family: ${FUENTE}; background-color: ${c.milk}; padding: 32px 16px;">
      <div style="max-width: 480px; margin: 0 auto; background-color: ${c.blanco}; border-radius: 12px; overflow: hidden; border: 1px solid ${c.blushOat};">
        <div style="background-color: ${c.espressoBrown}; padding: 28px 24px; text-align: center; border-bottom: 3px solid ${c.dustyRose};">
          <h1 style="color: ${c.milk}; font-size: 22px; margin: 0; font-weight: normal; letter-spacing: 0.5px;">Belissa Joyas</h1>
        </div>
        <div style="padding: 28px 24px;">
          <p style="color: ${c.espressoBrown}; font-size: 15px; margin: 0 0 16px;">${escaparHtml(op.saludo)}</p>
          ${parrafos}
          ${tablaDatos}
          ${tablaProductos}
          ${boton}
          ${pie}
        </div>
      </div>
    </div>
  `;
}
