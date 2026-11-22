-- Quita provincias creadas por pruebas automáticas (nombre + número largo, ej. "Córdoba 1794889020467")
CREATE TEMP TABLE mapa_prueba AS
SELECT p.id_provincia,
       (SELECT MIN(o.id_provincia) FROM provincia o
         WHERE o.nombre !~ '\s[0-9]{8,}$'
           AND lower(o.nombre) = lower(trim(regexp_replace(p.nombre, '\s+[0-9]{8,}$', '')))) AS id_real
FROM provincia p
WHERE p.nombre ~ '\s[0-9]{8,}$';

UPDATE direccion_envio d SET id_provincia = m.id_real
FROM mapa_prueba m WHERE d.id_provincia = m.id_provincia AND m.id_real IS NOT NULL;

DELETE FROM tarifa_envio WHERE id_provincia IN (SELECT id_provincia FROM mapa_prueba WHERE id_real IS NOT NULL);
DELETE FROM provincia WHERE id_provincia IN (SELECT id_provincia FROM mapa_prueba WHERE id_real IS NOT NULL);
DROP TABLE mapa_prueba;
