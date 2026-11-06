import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto, EstadoProducto } from './producto.entity.js';
import { CrearProductoDto } from './dto/crear-producto.dto.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { AccionAuditoria } from '../auditoria/log-auditoria.entity.js';

// Devuelve solo las claves indicadas de un objeto (para guardar en la auditoría
// únicamente lo que cambió, sin copiar el registro entero).
function tomar(obj: Record<string, any>, claves: string[]) {
  return Object.fromEntries(claves.map((k) => [k, obj[k]]));
}

@Injectable()
export class ProductoService {
  constructor(
    @InjectRepository(Producto)
    private readonly repo: Repository<Producto>,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // Lista de productos activos con el precio más bajo entre sus variantes activas,
  // para mostrarlo en el catálogo ("Desde $X" si las variantes tienen precios distintos).
  async findAll() {
    const productos = await this.repo.find({ where: { estado: EstadoProducto.ACTIVO } });
    const precios: { id_producto: number; precio_desde: string; precios_distintos: string }[] =
    await this.repo.manager.query(
      `SELECT id_producto,
                MIN(precio_venta) AS precio_desde,
                COUNT(DISTINCT precio_venta) AS precios_distintos
           FROM variante
          WHERE estado = 'activa'
          GROUP BY id_producto`,
      );
    const porProducto = new Map(precios.map((f) => [Number(f.id_producto), f]));
    return productos.map((p) => {
      const fila = porProducto.get(p.id_producto);
      return {
        ...p,
        precio_desde: fila ? Number(fila.precio_desde) : null,
        varios_precios: fila ? Number(fila.precios_distintos) > 1 : false,
      };
    });
  }

  async findById(id: number): Promise<Producto> {
    const producto = await this.repo.findOneBy({ id_producto: id });
    if (!producto) throw new NotFoundException(`Producto ${id} no encontrado`);
    return producto;
  }

  async create(dto: CrearProductoDto, id_usuario_admin?: number): Promise<Producto> {
    // Generar SKU automático — RF4
    const sku = `BEL-${Date.now()}`;
    const producto = await this.repo.save({ ...dto, codigo_sku: sku });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.CREAR,
      entidad: 'Producto',
      id_entidad: producto.id_producto,
      datos_nuevos: {
        nombre: producto.nombre,
        codigo_sku: producto.codigo_sku,
        id_subcategoria: producto.id_subcategoria,
      },
    });
    return producto;
  }

  async update(id: number, data: Partial<CrearProductoDto>, id_usuario_admin?: number): Promise<Producto> {
    const antes = await this.findById(id);
    await this.repo.update(id, data);
    const despues = await this.findById(id);

    const claves = Object.keys(data);
    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Producto',
      id_entidad: id,
      datos_anteriores: tomar(antes, claves),
      datos_nuevos: tomar(despues, claves),
    });
    return despues;
  }

  // Agrega una URL de imagen al array existente del producto (jsonb).
  async agregarImagen(id: number, url: string, id_usuario_admin?: number): Promise<Producto> {
    const producto = await this.findById(id);
    const imagenesActuales = producto.imagenes || [];
    const imagenesNuevas = [...imagenesActuales, url];
    await this.repo.update(id, { imagenes: imagenesNuevas });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Producto',
      id_entidad: id,
      datos_anteriores: { cantidad_imagenes: imagenesActuales.length },
      datos_nuevos: { cantidad_imagenes: imagenesNuevas.length, imagen_agregada: url },
    });
    return this.findById(id);
  }

  async eliminarImagen(id: number, url: string, id_usuario_admin?: number): Promise<Producto> {
    const producto = await this.findById(id);
    const imagenesActuales = producto.imagenes || [];
    const imagenesNuevas = imagenesActuales.filter((img) => img !== url);
    await this.repo.update(id, { imagenes: imagenesNuevas });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.EDITAR,
      entidad: 'Producto',
      id_entidad: id,
      datos_anteriores: { cantidad_imagenes: imagenesActuales.length, imagen_quitada: url },
      datos_nuevos: { cantidad_imagenes: imagenesNuevas.length },
    });
    return this.findById(id);
  }

  async bajaLogica(id: number, id_usuario_admin?: number): Promise<Producto> {
    const antes = await this.findById(id);
    await this.repo.update(id, { estado: EstadoProducto.INACTIVO });

    await this.auditoriaService.registrar({
      id_usuario: id_usuario_admin,
      accion: AccionAuditoria.ELIMINAR,
      entidad: 'Producto',
      id_entidad: id,
      datos_anteriores: { estado: antes.estado, nombre: antes.nombre },
      datos_nuevos: { estado: EstadoProducto.INACTIVO },
    });
    return this.findById(id);
  }
}
