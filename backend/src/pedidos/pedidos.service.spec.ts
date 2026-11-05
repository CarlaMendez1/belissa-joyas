import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PedidosService } from './pedidos.service.js';
import { EstadoCompra } from '../venta/venta.entity.js';

function ventaBase(extra: Record<string, unknown> = {}) {
  return {
    id_venta: 7,
    estado_compra: EstadoCompra.CONFIRMADA,
    tipo_entrega: 'domicilio',
    estado_envio: 'pendiente_despacho',
    precio_total: '10000',
    costo_envio: '4500',
    transportista: null,
    numero_seguimiento: null,
    envio_calle: 'Av. Siempre Viva',
    envio_numero: '742',
    envio_localidad: 'Springfield',
    envio_provincia: 'Buenos Aires',
    usuario: { nombre: 'Ana', apellido: 'Pérez', email: 'ana@mail.com' },
    ...extra,
  };
}

describe('PedidosService', () => {
  let ventaRepo: { findOne: jest.Mock; update: jest.Mock };
  let auditoria: { registrar: jest.Mock };
  let email: { enviar: jest.Mock };
  let config: { findByClave: jest.Mock };
  let service: PedidosService;

  function montar(ventaActual: any, ventaDespues?: any) {
    ventaRepo = {
      findOne: jest.fn().mockResolvedValueOnce(ventaActual).mockResolvedValue(ventaDespues ?? ventaActual),
      update: jest.fn().mockResolvedValue(undefined),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    email = { enviar: jest.fn().mockResolvedValue(true) };
    config = { findByClave: jest.fn().mockResolvedValue('Calle 123, lun a vie 10-18') };
    service = new PedidosService(ventaRepo as any, {} as any, auditoria as any, email as any, config as any);
  }

  it('despacha un envío a domicilio, audita y avisa por mail', async () => {
    const despues = ventaBase({ estado_envio: 'despachado', transportista: 'Correo Argentino', numero_seguimiento: 'AB123' });
    montar(ventaBase(), despues);

    const r = await service.cambiarEstado(
      7,
      { estado_envio: 'despachado', transportista: 'Correo Argentino', numero_seguimiento: 'AB123' },
      1,
    );

    expect(ventaRepo.update).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ estado_envio: 'despachado', transportista: 'Correo Argentino', numero_seguimiento: 'AB123' }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ entidad: 'Venta', id_entidad: 7, id_usuario: 1 }),
    );
    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(email.enviar.mock.calls[0][0]).toBe('ana@mail.com');
    expect(email.enviar.mock.calls[0][2]).toContain('AB123');
    expect(r.estado_envio).toBe('despachado');
  });

  it('exige transportista para despachar', async () => {
    montar(ventaBase());
    await expect(service.cambiarEstado(7, { estado_envio: 'despachado' }, 1)).rejects.toThrow(BadRequestException);
    expect(ventaRepo.update).not.toHaveBeenCalled();
  });

  it('no permite saltear estados (pendiente → entregado)', async () => {
    montar(ventaBase());
    await expect(service.cambiarEstado(7, { estado_envio: 'entregado' }, 1)).rejects.toThrow(BadRequestException);
  });

  it('un pedido a domicilio no puede pasar a retiro_listo', async () => {
    montar(ventaBase());
    await expect(service.cambiarEstado(7, { estado_envio: 'retiro_listo' }, 1)).rejects.toThrow(BadRequestException);
  });

  it('un retiro pasa a retiro_listo sin transportista y avisa con la dirección del local', async () => {
    const antes = ventaBase({ tipo_entrega: 'retiro' });
    montar(antes, { ...antes, estado_envio: 'retiro_listo' });

    await service.cambiarEstado(7, { estado_envio: 'retiro_listo' }, 1);

    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(email.enviar.mock.calls[0][2]).toContain('Calle 123');
  });

  it('un retiro no puede pasar a despachado', async () => {
    montar(ventaBase({ tipo_entrega: 'retiro' }));
    await expect(
      service.cambiarEstado(7, { estado_envio: 'despachado', transportista: 'X' }, 1),
    ).rejects.toThrow(BadRequestException);
  });

  it('marcar entregado no manda mail pero sí audita', async () => {
    const antes = ventaBase({ estado_envio: 'despachado', transportista: 'OCA' });
    montar(antes, { ...antes, estado_envio: 'entregado' });

    await service.cambiarEstado(7, { estado_envio: 'entregado' }, 1);

    expect(ventaRepo.update).toHaveBeenCalledWith(7, expect.objectContaining({ estado_envio: 'entregado', fecha_entrega: expect.any(Date) }));
    expect(auditoria.registrar).toHaveBeenCalled();
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('permite corregir el seguimiento de un pedido ya despachado sin reenviar el mail', async () => {
    const antes = ventaBase({ estado_envio: 'despachado', transportista: 'OCA', numero_seguimiento: 'VIEJO' });
    montar(antes, { ...antes, numero_seguimiento: 'NUEVO' });

    await service.cambiarEstado(7, { estado_envio: 'despachado', numero_seguimiento: 'NUEVO' }, 1);

    expect(ventaRepo.update).toHaveBeenCalledWith(7, { numero_seguimiento: 'NUEVO' });
    expect(email.enviar).not.toHaveBeenCalled();
  });

  it('repetir el mismo estado en un pedido entregado es un error', async () => {
    montar(ventaBase({ estado_envio: 'entregado' }));
    await expect(service.cambiarEstado(7, { estado_envio: 'entregado' }, 1)).rejects.toThrow(BadRequestException);
  });

  it('si el mail falla, el cambio de estado igual se guarda', async () => {
    const despues = ventaBase({ estado_envio: 'despachado', transportista: 'OCA' });
    montar(ventaBase(), despues);
    email.enviar.mockRejectedValue(new Error('smtp caído'));

    const r = await service.cambiarEstado(7, { estado_envio: 'despachado', transportista: 'OCA' }, 1);
    expect(r.estado_envio).toBe('despachado');
  });

  it('no encuentra ventas sin envío (viejas), pendientes o canceladas', async () => {
    montar(ventaBase({ tipo_entrega: null }));
    await expect(service.obtener(7)).rejects.toThrow(NotFoundException);

    montar(ventaBase({ estado_compra: EstadoCompra.PENDIENTE }));
    await expect(service.obtener(7)).rejects.toThrow(NotFoundException);
  });

  it('listar rechaza filtros inválidos', async () => {
    montar(ventaBase());
    await expect(service.listar({ estado_envio: 'volando' })).rejects.toThrow(BadRequestException);
    await expect(service.listar({ tipo_entrega: 'dron' })).rejects.toThrow(BadRequestException);
  });
});


describe('PedidosService - vista del cliente', () => {
  it('lista solo los pedidos confirmados del usuario indicado y arma el resumen con sus productos', async () => {
    const ventaRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id_venta: 7,
          id_usuario: 5,
          estado_compra: EstadoCompra.CONFIRMADA,
          tipo_entrega: 'domicilio',
          estado_envio: 'despachado',
          precio_total: '10000',
          costo_envio: '4500',
          transportista: 'OCA',
          numero_seguimiento: 'AB123',
          envio_calle: 'Calle',
          envio_numero: '1',
          envio_piso_depto: '2B',
          envio_localidad: 'CABA',
          envio_provincia: 'Ciudad Autónoma de Buenos Aires',
        },
        { id_venta: 3, id_usuario: 5, estado_compra: EstadoCompra.CONFIRMADA, tipo_entrega: null, estado_envio: null, precio_total: '2000', costo_envio: '0' },
      ]),
    };
    const detalleRepo = {
      find: jest.fn().mockResolvedValue([
        { id_detalle: 1, id_venta: 7, cantidad: 2, precio_unitario: '5000', sku_snapshot: 'SKU1', variante: { producto: { nombre: 'Anillo' } } },
        { id_detalle: 2, id_venta: 3, cantidad: 1, precio_unitario: '2000', sku_snapshot: 'SKU2', variante: null },
      ]),
    };
    const service = new PedidosService(ventaRepo as any, detalleRepo as any, {} as any, {} as any, {} as any);

    const r = await service.listarDeUsuario(5);

    expect(ventaRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id_usuario: 5, estado_compra: EstadoCompra.CONFIRMADA } }),
    );
    expect(r).toHaveLength(2);
    expect(r[0].total).toBe(14500);
    expect(r[0].destino).toBe('Calle 1, 2B, CABA, Ciudad Autónoma de Buenos Aires');
    expect(r[0].numero_seguimiento).toBe('AB123');
    expect(r[0].items).toEqual([expect.objectContaining({ producto: 'Anillo', cantidad: 2, subtotal: 10000 })]);
    // compra vieja, anterior a los envíos
    expect(r[1].tipo_entrega).toBeNull();
    expect(r[1].destino).toBeNull();
    expect(r[1].items[0].producto).toBe('SKU2');
    // no expone datos de otros usuarios ni el mail
    expect(r[0]).not.toHaveProperty('email');
    expect(r[0]).not.toHaveProperty('cliente');
  });

  it('sin compras devuelve lista vacía y no consulta detalles', async () => {
    const ventaRepo = { find: jest.fn().mockResolvedValue([]) };
    const detalleRepo = { find: jest.fn() };
    const service = new PedidosService(ventaRepo as any, detalleRepo as any, {} as any, {} as any, {} as any);
    expect(await service.listarDeUsuario(9)).toEqual([]);
    expect(detalleRepo.find).not.toHaveBeenCalled();
  });
});

