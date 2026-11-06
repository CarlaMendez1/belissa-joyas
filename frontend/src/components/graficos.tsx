// Gráficos simples sin librerías externas.

type Punto = { etiqueta: string; valor: number };

const ANCHO = 640;
const ALTO = 240;
const MARGEN = { arriba: 16, derecha: 16, abajo: 28, izquierda: 64 };

// Redondea el máximo a un número "lindo" para que las líneas de la grilla tengan sentido
function maximoLindo(max: number): number {
  if (max <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / exp;
  const lindo = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return lindo * exp;
}

export function GraficoLinea({
  puntos,
  formato,
}: {
  puntos: Punto[];
  formato: (n: number) => string;
}) {
  if (puntos.length === 0) return null;

  const max = maximoLindo(Math.max(...puntos.map((p) => p.valor)));
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;
  const x = (i: number) =>
    MARGEN.izquierda + (puntos.length === 1 ? anchoUtil / 2 : (i / (puntos.length - 1)) * anchoUtil);
  const y = (v: number) => MARGEN.arriba + altoUtil - (v / max) * altoUtil;

  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const area = `${linea} L${x(puntos.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const guias = [0, 0.25, 0.5, 0.75, 1];
  // Pocas etiquetas en el eje X para que no se pisen
  const paso = Math.max(1, Math.ceil(puntos.length / 7));
  const mostrarPuntos = puntos.length <= 45;

  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto text-cocoa-taupe" role="img">
      {guias.map((g) => (
        <g key={g}>
          <line
            x1={MARGEN.izquierda}
            x2={ANCHO - MARGEN.derecha}
            y1={y(max * g)}
            y2={y(max * g)}
            className="stroke-stone-200"
            strokeWidth={1}
          />
          <text x={MARGEN.izquierda - 8} y={y(max * g) + 4} textAnchor="end" className="fill-stone-400" fontSize={11}>
            {formato(max * g)}
          </text>
        </g>
      ))}
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={linea} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      {mostrarPuntos &&
        puntos.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.valor)} r={3.5} fill="currentColor">
            <title>{`${p.etiqueta}: ${formato(p.valor)}`}</title>
          </circle>
        ))}
      {puntos.map((p, i) =>
        i % paso === 0 || i === puntos.length - 1 ? (
          <text key={`x${i}`} x={x(i)} y={ALTO - 8} textAnchor="middle" className="fill-stone-500" fontSize={11}>
            {p.etiqueta}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// Barras horizontales: cada fila tiene su etiqueta, la barra proporcional y el valor
export function GraficoBarras({
  items,
  formato,
  detalle,
}: {
  items: { etiqueta: string; valor: number; extra?: string }[];
  formato: (n: number) => string;
  detalle?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.valor), 1);

  return (
    <div className="flex flex-col gap-3">
      {items.map((i) => (
        <div key={i.etiqueta}>
          <div className="flex justify-between gap-3 text-sm mb-1">
            <span className="text-stone-700 truncate">{i.etiqueta}</span>
            <span className="text-stone-800 font-medium whitespace-nowrap">
              {formato(i.valor)}
              {i.extra && <span className="text-stone-400 font-normal"> · {i.extra}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full rounded-full bg-cocoa-taupe" style={{ width: `${Math.max(2, (i.valor / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {detalle && <p className="text-xs text-stone-400">{detalle}</p>}
    </div>
  );
}
