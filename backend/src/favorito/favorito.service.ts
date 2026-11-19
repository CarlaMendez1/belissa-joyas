import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorito } from './favorito.entity.js';
import { Producto, EstadoProducto } from '../producto/producto.entity.js';

@Injectable()
export class FavoritoService {
  constructor(
    @InjectRepository(Favorito) private readonly favoritoRepo: Repository<Favorito>,
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
  ) {}

  /**
   * Productos favoritos del usuario, del más reciente al más antiguo, con lo que
   * la clienta necesita para decidir: descripción, precio, disponibilidad y las
   * características disponibles (material, talle, etc.) de sus variantes activas.
   */
  async listar(id_usuario: number) {
    const favoritos = await this.favoritoRepo.find({
      where: { id_usuario },
      relations: { producto: true },
      order: { fecha_alta: 'DESC' },
    });
    const activos = favoritos.filter((f) => f.producto && f.producto.estado === EstadoProducto.ACTIVO);
    if (!activos.length) return [];

    const ids = activos.map((f) => f.id_producto);
    const precios: { id_producto: number; precio_desde: string; precios_distintos: string; stock_total: string }[] =
      await this.favoritoRepo.manager.query(
        `SELECT id_producto,
                MIN(precio_venta) AS precio_desde,
                COUNT(DISTINCT precio_venta) AS precios_distintos,
                COALESCE(SUM(stock_disponible), 0) AS stock_total
           FROM variante
          WHERE estado = 'activa' AND id_producto = ANY($1)
          GROUP BY id_producto`,
        [ids],
      );
    const specs: { id_producto: number; opcion: string; unidad: string | null; valor: string }[] =
      await this.favoritoRepo.manager.query(
        `SELECT DISTINCT v.id_producto, o.nombre AS opcion, o.unidad, c.valor
           FROM variante v
           JOIN variante_caracteristica vc ON vc.id_variante = v.id_variante
           JOIN caracteristica c ON c.id_caracteristica = vc.id_caracteristica
           JOIN opcion o ON o.id_opcion = c.id_opcion
          WHERE v.estado = 'activa' AND v.id_producto = ANY($1)
          ORDER BY v.id_producto, o.nombre, c.valor`,
        [ids],
      );

    const precioPorProducto = new Map(precios.map((f) => [Number(f.id_producto), f]));
    const especificaciones = new Map<number, { opcion: string; valores: string[] }[]>();
    for (const fila of specs) {
      const id = Number(fila.id_producto);
      const lista = especificaciones.get(id) ?? [];
      let grupo = lista.find((g) => g.opcion === fila.opcion);
      if (!grupo) {
        grupo = { opcion: fila.opcion, valores: [] };
        lista.push(grupo);
      }
      grupo.valores.push(fila.unidad ? `${fila.valor} ${fila.unidad}` : fila.valor);
      especificaciones.set(id, lista);
    }

    return activos.map((f) => {
      const precio = precioPorProducto.get(f.id_producto);
      return {
        id_producto: f.producto.id_producto,
        nombre: f.producto.nombre,
        codigo_sku: f.producto.codigo_sku,
        descripcion: f.producto.descripcion,
        imagenes: f.producto.imagenes,
        fecha_alta: f.fecha_alta,
        precio_desde: precio ? Number(precio.precio_desde) : null,
        varios_precios: precio ? Number(precio.precios_distintos) > 1 : false,
        disponible: precio ? Number(precio.stock_total) > 0 : false,
        especificaciones: especificaciones.get(f.id_producto) ?? [],
      };
    });
  }

  /** Ids de los productos favoritos, para marcar el corazón en el catálogo. */
  async ids(id_usuario: number): Promise<number[]> {
    const favoritos = await this.favoritoRepo.find({ where: { id_usuario } });
    return favoritos.map((f) => f.id_producto);
  }

  /** Agrega un producto a favoritos. Es idempotente: repetirlo no duplica. */
  async agregar(id_usuario: number, id_producto: number) {
    const producto = await this.productoRepo.findOneBy({ id_producto });
    if (!producto || producto.estado !== EstadoProducto.ACTIVO) {
      throw new NotFoundException('Producto no encontrado');
    }
    const existente = await this.favoritoRepo.findOneBy({ id_usuario, id_producto });
    if (!existente) {
      await this.favoritoRepo.save(this.favoritoRepo.create({ id_usuario, id_producto }));
    }
    return { id_producto, favorito: true };
  }

  /** Quita un producto de favoritos. También es idempotente. */
  async quitar(id_usuario: number, id_producto: number) {
    await this.favoritoRepo.delete({ id_usuario, id_producto });
    return { id_producto, favorito: false };
  }
}
