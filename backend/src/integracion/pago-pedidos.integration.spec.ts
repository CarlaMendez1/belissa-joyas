import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Usuario, RolUsuario } from '../usuario/usuario.entity';
import { Subcategoria } from '../subcategoria/subcategoria.entity';
import { Provincia } from '../envios/provincia.entity';
import { TarifaEnvio } from '../envios/tarifa-envio.entity';

// Mercado Pago es un servicio externo: se simula. Todo lo demás (API, guardas,
// validaciones, transacciones y PostgreSQL) es real.
const mockPagosMP: Record<string, any> = {};
let mockSeqPreferencia = 0;
jest.mock('mercadopago', () => ({
  MercadoPagoConfig: jest.fn(),
  Preference: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockImplementation(async () => {
      mockSeqPreferencia += 1;
      return { id: `pref-test-${Date.now()}-${mockSeqPreferencia}`, init_point: 'https://mp.test/checkout' };
    }),
  })),
  Payment: jest.fn().mockImplementation(() => ({
    get: jest.fn().mockImplementation(async ({ id }: { id: string }) => {
      if (!mockPagosMP[id]) throw new Error('pago inexistente');
      return mockPagosMP[id];
    }),
  })),
}));

/**
 * Integración con base real: direcciones, checkout, webhook de Mercado Pago
 * (rechazado, aprobado y duplicado simultáneo) y gestión de pedidos.
 */
describe('Integración - direcciones, pago y pedidos (API + base de datos)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const sufijo = Date.now();
  const password = 'Belissa2026';
  const emailAdmin = `admin.pago.${sufijo}@belissa.com`;
  const emailCliente = `lucia.fernandez.${sufijo}@belissa.com`;
  const emailOtra = `sofia.paz.${sufijo}@belissa.com`;

  let tokenAdmin: string;
  let tokenCliente: string;
  let tokenOtra: string;
  let idVariante: number;
  let idProvincia: number;
  let idDireccion: number;
  let idVentaRechazada: number;
  let idVentaRetiro: number;
  let idVentaDomicilio: number;
  let seqPago = 0;
  const clavesCreadas: string[] = [];
  let nivelCreado = false;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const stock = async () =>
    Number((await ds.query('SELECT stock_disponible FROM variante WHERE id_variante = $1', [idVariante]))[0].stock_disponible);
  const venta = async (id: number) => (await ds.query('SELECT * FROM venta WHERE id_venta = $1', [id]))[0];

  const agregarAlCarrito = (token: string, cantidad: number) =>
    http().post('/carrito/item').set(auth(token)).send({ id_variante: idVariante, cantidad }).expect(201);

  const notificarPago = async (id_venta: number, status: string) => {
    seqPago += 1;
    const pid = `${sufijo}${seqPago}`;
    mockPagosMP[pid] = { id: pid, status, external_reference: String(id_venta), payment_method_id: 'visa' };
    return http().post('/pago/webhook').query({ type: 'payment', 'data.id': pid });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ds = app.get(DataSource);

    // Datos base que en producción vienen del seed
    const niveles = await ds.query('SELECT count(*)::int AS n FROM nivel_vip');
    if (niveles[0].n === 0) {
      await ds.query(
        `INSERT INTO nivel_vip (nombre_nivel, monto_min_requerido, cantidad_compras_min_requerida, porcentaje_descuento, beneficios)
         VALUES ('Plata', 0, 0, 0, 'Nivel inicial')`,
      );
      nivelCreado = true;
    }

    const prov = await ds.getRepository(Provincia).save({ nombre: `Mendoza ${sufijo}` } as any);
    idProvincia = (prov as any).id_provincia;
    await ds.getRepository(TarifaEnvio).save({ id_provincia: idProvincia, precio: 5800, plazo_dias: 4, activa: true } as any);

    // Cuentas
    await http().post('/auth/registro').send({ nombre: 'Carla', apellido: 'Méndez', email: emailAdmin, password }).expect(201);
    await ds.getRepository(Usuario).update({ email: emailAdmin }, { rol: RolUsuario.ADMINISTRADOR });
    tokenAdmin = (await http().post('/auth/login').send({ email: emailAdmin, password }).expect(201)).body.access_token;
    tokenCliente = (
      await http().post('/auth/registro').send({ nombre: 'Lucía', apellido: 'Fernández', email: emailCliente, password }).expect(201)
    ).body.access_token;
    tokenOtra = (
      await http().post('/auth/registro').send({ nombre: 'Sofía', apellido: 'Paz', email: emailOtra, password }).expect(201)
    ).body.access_token;

    // Catálogo: un anillo a $48.900 con 10 unidades
    const cat = await http().post('/categorias').set(auth(tokenAdmin)).send({ nombre: `Anillos pago ${sufijo}` }).expect(201);
    const sub = await ds.getRepository(Subcategoria).save({ id_categoria: cat.body.id_categoria, nombre: `Alianzas ${sufijo}` } as any);
    const prod = await http()
      .post('/productos')
      .set(auth(tokenAdmin))
      .send({ id_subcategoria: (sub as any).id_subcategoria, nombre: 'Alianza oro 18k lisa' })
      .expect(201);
    const varnt = await http()
      .post('/variantes')
      .set(auth(tokenAdmin))
      .send({ id_producto: prod.body.id_producto, precio_venta: 48900, stock_disponible: 10 })
      .expect(201);
    idVariante = varnt.body.id_variante;
  });

  afterAll(async () => {
    for (const clave of clavesCreadas) await ds.query('DELETE FROM configuracion WHERE clave = $1', [clave]);
    if (nivelCreado) {
      await ds.query('DELETE FROM cliente_vip');
      await ds.query('DELETE FROM nivel_vip');
    }
    await app.close();
  });

  const fijarConfig = async (clave: string, valor: string) => {
    const existe = await ds.query('SELECT 1 FROM configuracion WHERE clave = $1', [clave]);
    if (existe.length === 0) {
      await ds.query('INSERT INTO configuracion (clave, valor, descripcion) VALUES ($1, $2, $3)', [clave, valor, 'prueba']);
      clavesCreadas.push(clave);
    } else {
      await ds.query('UPDATE configuracion SET valor = $2 WHERE clave = $1', [clave, valor]);
    }
  };

  describe('Mi dirección', () => {
    const datos = () => ({
      nombre_destinatario: 'Lucía Fernández',
      telefono: '+54 261 555 0142',
      calle: 'Av. San Martín',
      numero: '1234',
      piso_depto: '3° B',
      localidad: 'Ciudad de Mendoza',
      id_provincia: idProvincia,
      codigo_postal: '5500',
    });

    it('exige estar autenticada', async () => {
      await http().get('/direcciones').expect(401);
    });

    it('rechaza un código postal inválido (400)', async () => {
      await http().post('/direcciones').set(auth(tokenCliente)).send({ ...datos(), codigo_postal: '12' }).expect(400);
    });

    it('rechaza una provincia inexistente (400)', async () => {
      await http().post('/direcciones').set(auth(tokenCliente)).send({ ...datos(), id_provincia: 999999 }).expect(400);
    });

    it('guarda la primera dirección como predeterminada', async () => {
      const res = await http().post('/direcciones').set(auth(tokenCliente)).send(datos()).expect(201);
      idDireccion = res.body.id_direccion;
      expect(res.body.es_predeterminada).toBe(true);
    });

    it('no permite una segunda dirección activa (409)', async () => {
      await http().post('/direcciones').set(auth(tokenCliente)).send(datos()).expect(409);
    });

    it('permite editar la dirección propia', async () => {
      const res = await http().patch(`/direcciones/${idDireccion}`).set(auth(tokenCliente)).send({ numero: '1250' }).expect(200);
      expect(res.body.numero).toBe('1250');
    });

    it('otra clienta no puede editar una dirección ajena (404)', async () => {
      await http().patch(`/direcciones/${idDireccion}`).set(auth(tokenOtra)).send({ numero: '1' }).expect(404);
    });

    it('cada clienta ve solo sus direcciones', async () => {
      const mia = await http().get('/direcciones').set(auth(tokenCliente)).expect(200);
      const ajena = await http().get('/direcciones').set(auth(tokenOtra)).expect(200);
      expect(mia.body).toHaveLength(1);
      expect(ajena.body).toHaveLength(0);
    });
  });

  describe('Checkout', () => {
    it('rechaza pagar sin un carrito activo (404)', async () => {
      await http().post('/pago/crear-preferencia').set(auth(tokenCliente)).send({ tipo_entrega: 'domicilio', id_direccion: idDireccion }).expect(404);
    });

    it('rechaza un tipo de entrega inválido (400)', async () => {
      await agregarAlCarrito(tokenCliente, 1);
      await http().post('/pago/resumen').set(auth(tokenCliente)).send({ tipo_entrega: 'drone' }).expect(400);
    });

    it('rechaza el retiro en local si está desactivado (400)', async () => {
      await fijarConfig('retiro_local_activo', 'false');
      await http().post('/pago/resumen').set(auth(tokenCliente)).send({ tipo_entrega: 'retiro' }).expect(400);
    });

    it('rechaza domicilio sin elegir dirección (400)', async () => {
      await http().post('/pago/resumen').set(auth(tokenCliente)).send({ tipo_entrega: 'domicilio' }).expect(400);
    });

    it('rechaza usar la dirección de otra clienta (404)', async () => {
      await agregarAlCarrito(tokenOtra, 1);
      await http().post('/pago/resumen').set(auth(tokenOtra)).send({ tipo_entrega: 'domicilio', id_direccion: idDireccion }).expect(404);
      await http().delete('/carrito/vaciar').set(auth(tokenOtra)).expect(200);
    });

    it('resumen a domicilio: productos + tarifa de la provincia', async () => {
      const res = await http()
        .post('/pago/resumen')
        .set(auth(tokenCliente))
        .send({ tipo_entrega: 'domicilio', id_direccion: idDireccion })
        .expect(201);
      expect(res.body.subtotal_productos).toBe(48900);
      expect(res.body.costo_envio).toBe(5800);
      expect(res.body.total).toBe(54700);
    });

    it('resumen con retiro en local activo: envío en cero', async () => {
      await fijarConfig('retiro_local_activo', 'true');
      await fijarConfig('retiro_local_direccion', 'Av. Libertador 450, Mendoza');
      const res = await http().post('/pago/resumen').set(auth(tokenCliente)).send({ tipo_entrega: 'retiro' }).expect(201);
      expect(res.body.costo_envio).toBe(0);
      expect(res.body.total).toBe(48900);
    });
  });

  describe('Pago con Mercado Pago (webhook)', () => {
    it('crea la preferencia: venta pendiente, pago pendiente y sin tocar el stock', async () => {
      const res = await http().post('/pago/crear-preferencia').set(auth(tokenCliente)).send({ tipo_entrega: 'retiro' }).expect(201);
      idVentaRechazada = res.body.id_venta;
      expect(res.body.init_point).toContain('mp.test');
      const v = await venta(idVentaRechazada);
      expect(v.estado_compra).toBe('pendiente');
      expect(v.stock_descontado).toBe(false);
      const pagos = await ds.query('SELECT estado_pago FROM pago WHERE id_venta = $1', [idVentaRechazada]);
      expect(pagos[0].estado_pago).toBe('pendiente');
      expect(await stock()).toBe(10);
    });

    it('ignora notificaciones que no son de pago', async () => {
      const res = await http().post('/pago/webhook').query({ type: 'merchant_order', 'data.id': '1' }).expect(201);
      expect(res.body.recibido).toBe(true);
    });

    it('pago rechazado: cancela la venta y no descuenta stock', async () => {
      await notificarPago(idVentaRechazada, 'rejected').then((r) => expect(r.status).toBe(201));
      const v = await venta(idVentaRechazada);
      expect(v.estado_compra).toBe('cancelada');
      expect(v.stock_descontado).toBe(false);
      expect(await stock()).toBe(10);
    });

    it('pago aprobado: confirma la venta, descuenta stock, convierte el carrito y crea el nivel VIP', async () => {
      const res = await http().post('/pago/crear-preferencia').set(auth(tokenCliente)).send({ tipo_entrega: 'retiro' }).expect(201);
      idVentaRetiro = res.body.id_venta;
      await notificarPago(idVentaRetiro, 'approved');
      const v = await venta(idVentaRetiro);
      expect(v.estado_compra).toBe('confirmada');
      expect(v.stock_descontado).toBe(true);
      expect(await stock()).toBe(9);
      const carrito = await ds.query('SELECT estado FROM carrito WHERE id_carrito = $1', [v.id_carrito]);
      expect(carrito[0].estado).toBe('convertido');
      const vip = await ds.query(
        'SELECT cv.id_nivel_vip FROM cliente_vip cv JOIN usuario u ON u.id_usuario = cv.id_usuario WHERE u.email = $1',
        [emailCliente],
      );
      expect(vip).toHaveLength(1);
    });

    it('deja registrada la confirmación en la auditoría', async () => {
      const filas = await ds.query(
        `SELECT datos_nuevos FROM log_auditoria WHERE entidad = 'Venta' AND id_entidad = $1 ORDER BY id_log DESC LIMIT 1`,
        [idVentaRetiro],
      );
      expect(JSON.stringify(filas[0].datos_nuevos)).toContain('confirmada');
    });

    it('barrera de concurrencia: tres webhooks simultáneos descuentan el stock una sola vez', async () => {
      await agregarAlCarrito(tokenCliente, 2);
      const res = await http()
        .post('/pago/crear-preferencia')
        .set(auth(tokenCliente))
        .send({ tipo_entrega: 'domicilio', id_direccion: idDireccion })
        .expect(201);
      idVentaDomicilio = res.body.id_venta;
      const v0 = await venta(idVentaDomicilio);
      expect(v0.costo_envio).toBe('5800.00');
      expect(v0.envio_calle).toBe('Av. San Martín');

      await Promise.all([
        notificarPago(idVentaDomicilio, 'approved'),
        notificarPago(idVentaDomicilio, 'approved'),
        notificarPago(idVentaDomicilio, 'approved'),
      ]);
      expect((await venta(idVentaDomicilio)).estado_compra).toBe('confirmada');
      expect(await stock()).toBe(7); // 9 - 2, no 9 - 6
    });

    it('repetir el aviso de un pago ya aprobado no vuelve a descontar', async () => {
      await notificarPago(idVentaDomicilio, 'approved');
      expect(await stock()).toBe(7);
    });
  });

  describe('Pedidos (administración)', () => {
    it('una clienta no puede ver los pedidos de administración (403)', async () => {
      await http().get('/pedidos').set(auth(tokenCliente)).expect(403);
    });

    it('la administradora ve los pedidos confirmados y no los cancelados', async () => {
      const res = await http().get('/pedidos').set(auth(tokenAdmin)).expect(200);
      const ids = res.body.items.map((p: any) => p.id_venta);
      expect(ids).toContain(idVentaDomicilio);
      expect(ids).toContain(idVentaRetiro);
      expect(ids).not.toContain(idVentaRechazada);
    });

    it('filtra por tipo de entrega y rechaza filtros inválidos', async () => {
      const res = await http().get('/pedidos').query({ tipo_entrega: 'retiro' }).set(auth(tokenAdmin)).expect(200);
      expect(res.body.items.every((p: any) => p.tipo_entrega === 'retiro')).toBe(true);
      await http().get('/pedidos').query({ estado_envio: 'volando' }).set(auth(tokenAdmin)).expect(400);
    });

    it('el detalle muestra la dirección copiada y los productos', async () => {
      const res = await http().get(`/pedidos/${idVentaDomicilio}`).set(auth(tokenAdmin)).expect(200);
      expect(res.body.direccion.calle).toBe('Av. San Martín');
      expect(res.body.items[0].cantidad).toBe(2);
      // El descuento VIP depende de los niveles cargados en la base, así que no se fija un monto exacto
      expect(res.body.costo_envio).toBe(5800);
      expect(res.body.subtotal_productos).toBeGreaterThan(0);
      expect(res.body.subtotal_productos).toBeLessThanOrEqual(2 * 48900);
      expect(res.body.total).toBe(res.body.subtotal_productos + res.body.costo_envio);
    });

    it('un pedido cancelado no existe para administración (404)', async () => {
      await http().get(`/pedidos/${idVentaRechazada}`).set(auth(tokenAdmin)).expect(404);
    });

    it('no se puede saltear estados (pendiente → entregado)', async () => {
      await http().patch(`/pedidos/${idVentaDomicilio}/estado`).set(auth(tokenAdmin)).send({ estado_envio: 'entregado' }).expect(400);
    });

    it('despachar exige transportista', async () => {
      await http().patch(`/pedidos/${idVentaDomicilio}/estado`).set(auth(tokenAdmin)).send({ estado_envio: 'despachado' }).expect(400);
    });

    it('despacha con transportista y seguimiento, y lo audita', async () => {
      const res = await http()
        .patch(`/pedidos/${idVentaDomicilio}/estado`)
        .set(auth(tokenAdmin))
        .send({ estado_envio: 'despachado', transportista: 'Andreani', numero_seguimiento: 'AND-884201' })
        .expect(200);
      expect(res.body.estado_envio).toBe('despachado');
      expect(res.body.transportista).toBe('Andreani');
      const filas = await ds.query(
        `SELECT datos_nuevos FROM log_auditoria WHERE entidad = 'Venta' AND id_entidad = $1 ORDER BY id_log DESC LIMIT 1`,
        [idVentaDomicilio],
      );
      expect(JSON.stringify(filas[0].datos_nuevos)).toContain('despachado');
    });

    it('un retiro no puede pasar a despachado y sí a retiro_listo', async () => {
      await http()
        .patch(`/pedidos/${idVentaRetiro}/estado`)
        .set(auth(tokenAdmin))
        .send({ estado_envio: 'despachado', transportista: 'Andreani' })
        .expect(400);
      const res = await http().patch(`/pedidos/${idVentaRetiro}/estado`).set(auth(tokenAdmin)).send({ estado_envio: 'retiro_listo' }).expect(200);
      expect(res.body.estado_envio).toBe('retiro_listo');
    });

    it('marca el pedido como entregado', async () => {
      const res = await http().patch(`/pedidos/${idVentaDomicilio}/estado`).set(auth(tokenAdmin)).send({ estado_envio: 'entregado' }).expect(200);
      expect(res.body.estado_envio).toBe('entregado');
      expect(res.body.fecha_entrega).not.toBeNull();
    });
  });

  describe('Mis pedidos (clienta)', () => {
    it('exige estar autenticada', async () => {
      await http().get('/mis-pedidos').expect(401);
    });

    it('la clienta ve solo sus pedidos confirmados, con productos y seguimiento', async () => {
      const res = await http().get('/mis-pedidos').set(auth(tokenCliente)).expect(200);
      const ids = res.body.map((p: any) => p.id_venta);
      expect(ids).toEqual(expect.arrayContaining([idVentaDomicilio, idVentaRetiro]));
      expect(ids).not.toContain(idVentaRechazada);
      const dom = res.body.find((p: any) => p.id_venta === idVentaDomicilio);
      expect(dom.numero_seguimiento).toBe('AND-884201');
      expect(dom.items[0].producto).toBe('Alianza oro 18k lisa');
    });

    it('otra clienta no ve pedidos ajenos', async () => {
      const res = await http().get('/mis-pedidos').set(auth(tokenOtra)).expect(200);
      expect(res.body).toHaveLength(0);
    });
  });
});
