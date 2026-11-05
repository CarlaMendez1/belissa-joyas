-- Una sola dirección de envío activa por usuario

-- Si algún usuario tenía varias, se conserva la más reciente
UPDATE direccion_envio d
SET activa = false, es_predeterminada = false
WHERE d.activa = true
  AND d.id_direccion <> (
    SELECT MAX(x.id_direccion) FROM direccion_envio x
    WHERE x.id_usuario = d.id_usuario AND x.activa = true
  );

-- La que queda es siempre la predeterminada
UPDATE direccion_envio SET es_predeterminada = true WHERE activa = true;

-- Seguro de base: una sola dirección activa por usuario
CREATE UNIQUE INDEX IF NOT EXISTS uq_direccion_una_activa_por_usuario
  ON direccion_envio (id_usuario) WHERE activa = true;
  