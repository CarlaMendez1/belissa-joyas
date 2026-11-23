-- Stock mínimo configurable (Configuración del panel de administración)
INSERT INTO configuracion (clave, valor, descripcion)
VALUES (
  'stock_minimo',
  '3',
  'Cantidad de unidades a partir de la cual una variante se considera con stock crítico en el panel de administración'
)
ON CONFLICT (clave) DO NOTHING;
