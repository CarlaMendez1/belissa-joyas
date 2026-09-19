import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrito, EstadoCarrito } from './carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { ClienteVipService } from '../cliente-vip/cliente-vip.service.js';

@Injectable()
export class CarritoService {
  constructor(
    @InjectRepository(Carrito)
    private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(ItemCarrito)
    private readonly itemRepo: Repository<ItemCarrito>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
    private readonly clienteVipService: ClienteVipService,
  ) {}

  private async obtenerOCrearCarritoActivo(id_usuario: number): Promise<Carrito> {
    let carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (carrito) return carrito;

    const carritoAbandonado = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ABANDONADO },
      order: { fecha_ultima_act: 'DESC' },
    });
    if (carritoAbandonado) {
      carritoAbandonado.estado = EstadoCarrito.ACTIVO;
      return this.carritoRepo.save(carritoAbandonado);
    }

    return this.carritoRepo.save({ id_usuario });
  }

  // Arma la respuesta del carrito incluyendo el descuento VIP, sin modificar
  // lo que se guarda en la base (precio_subtotal sigue siendo el bruto).
  private async armarRespuesta(carrito: Carrito, id_usuario: number) {
    const items = await this.itemRepo.find({
      where: { id_carrito: carrito.id_carrito },
      relations: { variante: true },
    });

    const clienteVip = await this.clienteVipService.obtenerPorUsuario(id_usuario);
    const porcentaje_descuento = clienteVip ? Number(clienteVip.nivel.porcentaje_descuento) : 0;
    const subtotal = Number(carrito.precio_subtotal);
    const monto_descuento = Math.round(subtotal * (porcentaje_descuento / 100) * 100) / 100;
    const total_con_descuento = subtotal - monto_descuento;

    return {
      ...carrito,
      items,
      nivel_vip: clienteVip?.nivel?.nombre_nivel || null,
      porcentaje_descuento,
      monto_descuento,
      total_con_descuento,
    };
  }

  async obtenerCarrito(id_usuario: number): Promise<any> {
    const carrito = await this.obtenerOCrearCarritoActivo(id_usuario);
    return this.armarRespuesta(carrito, id_usuario);
  }

  async agregarItem(id_usuario: number, dto: AgregarItemDto): Promise<any> {
    const variante = await this.varianteRepo.findOneBy({ id_variante: dto.id_variante });
    if (!variante) throw new NotFoundException('Variante no encontrada');
    if (variante.stock_disponible < dto.cantidad)
      throw new BadRequestException('Stock insuficiente');

    const carrito = await this.obtenerOCrearCarritoActivo(id_usuario);

    let item = await this.itemRepo.findOne({
      where: { id_carrito: carrito.id_carrito, id_variante: dto.id_variante },
    });
    if (item) {
      item.cantidad = dto.cantidad;
      await this.itemRepo.save(item);
    } else {
      await this.itemRepo.save({
        id_carrito:     carrito.id_carrito,
        id_variante:    dto.id_variante,
        cantidad:       dto.cantidad,
        precio_unitario: Number(variante.precio_venta),
      });
    }
    return this.recalcularSubtotal(carrito.id_carrito, id_usuario);
  }

  async eliminarItem(id_usuario: number, id_variante: number): Promise<any> {
    const carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (!carrito) throw new NotFoundException('Carrito no encontrado');
    await this.itemRepo.delete({
      id_carrito: carrito.id_carrito,
      id_variante,
    });
    return this.recalcularSubtotal(carrito.id_carrito, id_usuario);
  }

  async vaciarCarrito(id_usuario: number): Promise<any> {
    const carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (!carrito) throw new NotFoundException('Carrito no encontrado');
    await this.itemRepo.delete({ id_carrito: carrito.id_carrito });
    await this.carritoRepo.update(carrito.id_carrito, { precio_subtotal: 0 });
    return { mensaje: 'Carrito vaciado', id_carrito: carrito.id_carrito };
  }

  private async recalcularSubtotal(id_carrito: number, id_usuario: number): Promise<any> {
    const items = await this.itemRepo.find({ where: { id_carrito }, relations: { variante: true } });
    const subtotal = items.reduce((acc, i) => acc + Number(i.precio_unitario) * i.cantidad, 0);
    await this.carritoRepo.update(id_carrito, { precio_subtotal: subtotal });
    const carrito = await this.carritoRepo.findOneBy({ id_carrito });
    if (!carrito) throw new NotFoundException('Carrito no encontrado');
    return this.armarRespuesta(carrito, id_usuario);
  }
}