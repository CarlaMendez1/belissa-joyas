-- Productos que se muestran en el carrusel del inicio, con su orden
CREATE TABLE IF NOT EXISTS carrusel_inicio (
  id_producto INTEGER PRIMARY KEY REFERENCES producto(id_producto) ON DELETE CASCADE,
  posicion    INTEGER NOT NULL
);
