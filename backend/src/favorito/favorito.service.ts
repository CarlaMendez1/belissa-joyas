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

  /** Productos favoritos del usuario, del más reciente al más antiguo. */
  async listar(id_usuario: number) {
    const favoritos = await this.favoritoRepo.find({
      where: { id_usuario },
      relations: { producto: true },
      order: { fecha_alta: 'DESC' },
    });
    return favoritos
      .filter((f) => f.producto && f.producto.estado === EstadoProducto.ACTIVO)
      .map((f) => ({
        id_producto: f.producto.id_producto,
        nombre: f.producto.nombre,
        codigo_sku: f.producto.codigo_sku,
        imagenes: f.producto.imagenes,
        fecha_alta: f.fecha_alta,
      }));
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
