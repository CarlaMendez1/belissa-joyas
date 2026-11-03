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

  findAll(): Promise<Producto[]> {
    return this.repo.find({ where: { estado: EstadoProducto.ACTIVO } });
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
