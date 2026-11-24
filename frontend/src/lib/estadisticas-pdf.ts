// Exportación a PDF de un apartado de Estadísticas. Todos los apartados usan la misma plantilla.
export type SpecPDF = {
  titulo: string;
  periodo: string;
  comparacion?: string;
  kpis: { titulo: string; valor: string }[];
  tablas: { titulo: string; cabeceras: string[]; filas: (string | number)[][] }[];
  nota?: string;
};

export async function exportarPDF(spec: SpecPDF, nombreArchivo: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margen = 40;
  const ancho = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(59, 47, 42);
  doc.text('Belissa Joyas · Estadísticas', margen, 50);
  doc.setFontSize(14).setTextColor(122, 98, 88);
  doc.text(spec.titulo, margen, 74);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(90);
  doc.text(`Período: ${spec.periodo}`, margen, 92);
  let y = 106;
  if (spec.comparacion) {
    doc.text(`Comparado con: ${spec.comparacion}`, margen, y);
    y += 14;
  }
  y += 8;

  // KPIs en cuatro columnas iguales
  const colAncho = (ancho - margen * 2) / 4;
  spec.kpis.forEach((k, i) => {
    const x = margen + i * colAncho;
    doc.setDrawColor(232, 216, 206).roundedRect(x, y, colAncho - 8, 52, 6, 6);
    doc.setFontSize(8).setTextColor(120).text(k.titulo, x + 8, y + 16, { maxWidth: colAncho - 24 });
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(59, 47, 42).text(k.valor, x + 8, y + 40);
    doc.setFont('helvetica', 'normal');
  });
  y += 72;

  for (const t of spec.tablas) {
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(59, 47, 42).text(t.titulo, margen, y);
    autoTable(doc, {
      startY: y + 6,
      head: [t.cabeceras],
      body: t.filas.length ? t.filas.map((f) => f.map(String)) : [['Sin datos en este período']],
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [185, 143, 136] },
      margin: { left: margen, right: margen },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
  }

  if (spec.nota) {
    doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(120).text(spec.nota, margen, y, { maxWidth: ancho - margen * 2 });
  }
  doc.save(`${nombreArchivo}.pdf`);
}
