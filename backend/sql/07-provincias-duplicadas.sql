-- Quita las provincias repetidas (por ejemplo "Córdoba" dos veces).
-- Se conserva una por nombre (prefiere la que tiene tarifa de envío) y se
-- reasignan las direcciones que usaban la repetida.

CREATE TEMP TABLE mapa_provincias AS
SELECT p.id_provincia,
       FIRST_VALUE(p.id_provincia) OVER (
         PARTITION BY translate(lower(trim(p.nombre)), 'áéíóúü', 'aeiouu')
         ORDER BY EXISTS (SELECT 1 FROM tarifa_envio t WHERE t.id_provincia = p.id_provincia) DESC,
                  p.id_provincia
       ) AS id_conservar
FROM provincia p;

UPDATE direccion_envio d
SET id_provincia = m.id_conservar
FROM mapa_provincias m
WHERE d.id_provincia = m.id_provincia AND m.id_provincia <> m.id_conservar;

DELETE FROM tarifa_envio
WHERE id_provincia IN (SELECT id_provincia FROM mapa_provincias WHERE id_provincia <> id_conservar);

DELETE FROM provincia
WHERE id_provincia IN (SELECT id_provincia FROM mapa_provincias WHERE id_provincia <> id_conservar);

DROP TABLE mapa_provincias;

-- Evita que vuelva a pasar
CREATE UNIQUE INDEX IF NOT EXISTS uq_provincia_nombre
  ON provincia ((translate(lower(trim(nombre)), 'áéíóúü', 'aeiouu')));
