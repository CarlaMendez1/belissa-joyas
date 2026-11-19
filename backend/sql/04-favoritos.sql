-- Productos favoritos de cada usuario
CREATE TABLE IF NOT EXISTS favorito (
  id_favorito SERIAL PRIMARY KEY,
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_producto INTEGER NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  fecha_alta  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_favorito_usuario_producto UNIQUE (id_usuario, id_producto)
);
