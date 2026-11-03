// Devuelve solo las claves indicadas de un objeto, para guardar en la auditoría
// únicamente lo que cambió (sin copiar el registro entero).
export function tomar(obj: Record<string, any>, claves: string[]) {
  return Object.fromEntries(claves.map((k) => [k, obj[k]]));
}
