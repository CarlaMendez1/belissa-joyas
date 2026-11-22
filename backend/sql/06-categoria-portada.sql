-- Foto de portada de cada categoría (la elige la administradora; opcional)
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS imagen_portada VARCHAR(500);
