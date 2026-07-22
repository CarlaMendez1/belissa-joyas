import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrito, EstadoCarrito } from './carrito.entity.js';
import { ItemCarrito } from '../item-carrito/item-carrito.entity.js';
import { Variante } from '../variante/variante.entity.js';
import { AgregarItemDto } from './dto/agregar-item.dto.js';

@Injectable()
export class CarritoService {
  constructor(
    @InjectRepository(Carrito)
    private readonly carritoRepo: Repository<Carrito>,
    @InjectRepository(ItemCarrito)
    private readonly itemRepo: Repository<ItemCarrito>,
    @InjectRepository(Variante)
    private readonly varianteRepo: Repository<Variante>,
  ) {}

  // Obtener o crear carrito activo del usuario
  async obtenerCarrito(id_usuario: number): Promise<any> {
    let carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (!carrito) {
      carrito = await this.carritoRepo.save({ id_usuario });
    }
    const items = await this.itemRepo.find({
      where: { id_carrito: carrito.id_carrito },
      relations: { variante: true },
    });
    return { ...carrito, items };
  }

  // Agregar o actualizar ítem en el carrito — RF31
  async agregarItem(id_usuario: number, dto: AgregarItemDto): Promise<any> {
    const variante = await this.varianteRepo.findOneBy({ id_variante: dto.id_variante });
    if (!variante) throw new NotFoundException('Variante no encontrada');
    if (variante.stock_disponible < dto.cantidad)
      throw new BadRequestException('Stock insuficiente');

    let carrito = await this.carritoRepo.findOne({
      where: { id_usuario, estado: EstadoCarrito.ACTIVO },
    });
    if (!carrito) carrito = await this.carritoRepo.save({ id_usuario });

    // Si ya existe el ítem, actualizar cantidad
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

  // Eliminar ítem del carrito — RF32
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

  // Vaciar carrito
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
    return { ...carrito, items };
  }
}