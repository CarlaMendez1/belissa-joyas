import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Producto, EstadoProducto } from '../producto/producto.entity.js';
import { Categoria, EstadoGeneral } from '../categoria/categoria.entity.js';
import { ClienteVip } from '../cliente-vip/cliente-vip.entity.js';
import { Venta, EstadoCompra } from '../venta/venta.entity.js';
import { LogAuditoria } from '../auditoria/log-auditoria.entity.js';

const DIAS_VENTAS = 30;
const CANTIDAD_ACTIVIDAD = 8;

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Producto) private readonly productoRepo: Repository<Producto>,
    @InjectRepository(Categoria) private readonly categoriaRepo: Repository<Categoria>,
    @InjectRepository(ClienteVip) private readonly clienteVipRepo: Repository<ClienteVip>,
    @InjectRepository(Venta) private readonly ventaRepo: Repository<Venta>,
    @InjectRepository(LogAuditoria) private readonly logRepo: Repository<LogAuditoria>,
  ) {}

  async obtenerResumen() {
    const [
      productosActivos,
      categorias,
      clientesVip,
      clientesPorNivel,
      ventas,
      actividad,
    ] = await Promise.all([
      this.productoRepo.count({ where: { estado: EstadoProducto.ACTIVO } }),
      this.categoriaRepo.count({ where: { estado: EstadoGeneral.ACTIVA } }),
      this.clienteVipRepo.count(),
      this.contarClientesPorNivel(),
      this.resumirVentas(),
      this.actividadReciente(),
    ]);

    return {
      productos_activos: productosActivos,
      categorias,
      clientes_vip: { total: clientesVip, por_nivel: clientesPorNivel },
      ventas_confirmadas: { dias: DIAS_VENTAS, ...ventas },
      actividad_reciente: actividad,
    };
  }

  private async contarClientesPorNivel() {
    const filas = await this.clienteVipRepo
      .createQueryBuilder('cv')
      .leftJoin('cv.nivel', 'n')
      .select('n.nombre_nivel', 'nivel')
      .addSelect('COUNT(*)', 'cantidad')
      .groupBy('n.nombre_nivel')
      .getRawMany<{ nivel: string; cantidad: string }>();

    return filas.map((f) => ({ nivel: f.nivel, cantidad: Number(f.cantidad) }));
  }

  private async resumirVentas() {
    const desde = new Date();
    desde.setDate(desde.getDate() - DIAS_VENTAS);

    const fila = await this.ventaRepo
      .createQueryBuilder('v')
      .select('COUNT(*)', 'cantidad')
      .addSelect('COALESCE(SUM(v.precio_total), 0)', 'monto_total')
      .where('v.estado_compra = :estado', { estado: EstadoCompra.CONFIRMADA })
      .andWhere('v.fecha_compra >= :desde', { desde })
      .getRawOne<{ cantidad: string; monto_total: string }>();

    return {
      cantidad: Number(fila?.cantidad ?? 0),
      monto_total: Number(fila?.monto_total ?? 0),
    };
  }

  // Devuelve solo los datos que la pantalla necesita: la entidad Usuario incluye
  // password_hash y no debe salir nunca por la API.
  private async actividadReciente() {
    const logs = await this.logRepo.find({
      relations: { usuario: true },
      order: { fecha: 'DESC' },
      take: CANTIDAD_ACTIVIDAD,
    });

    return logs.map((l) => ({
      id_log: l.id_log,
      accion: l.accion,
      entidad: l.entidad,
      id_entidad: l.id_entidad,
      // Dato que identifica el cambio cuando no hay id numérico (clave de configuración, provincia)
      detalle: this.detalleDe(l.datos_nuevos ?? l.datos_anteriores),
      fecha: l.fecha,
      usuario: l.usuario ? `${l.usuario.nombre} ${l.usuario.apellido}`.trim() : null,
    }));
  }

  // Solo se expone el texto de estas dos claves, nunca el resto del registro.
  private detalleDe(datos: unknown): string | null {
    if (!datos || typeof datos !== 'object') return null;
    const { clave, provincia } = datos as { clave?: unknown; provincia?: unknown };
    if (typeof clave === 'string') return clave;
    if (typeof provincia === 'string') return provincia;
    return null;
  }
}
