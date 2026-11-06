// Descarga un CSV listo para abrir en Excel en español:
// separador ";", coma decimal y BOM para que se vean bien las tildes.
type Celda = string | number | null | undefined;

function aTexto(valor: Celda): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return String(valor).replace('.', ',');
  const texto = String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function descargarCSV(nombreArchivo: string, encabezados: string[], filas: Celda[][]) {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(aTexto).join(';'));
  const contenido = '\uFEFF' + lineas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
