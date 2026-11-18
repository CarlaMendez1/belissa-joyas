import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Usuario, RolUsuario } from '../usuario/usuario.entity';
import { Subcategoria } from '../subcategoria/subcategoria.entity';
import { Provincia } from '../envios/provincia.entity';
import { TarifaEnvio } from '../envios/tarifa-envio.entity';

/**
 * Pruebas de integración con base de datos real (PostgreSQL de prueba).
 * Recorren el flujo de la tienda de punta a punta a través de la API HTTP:
 * cuentas y roles, catálogo, carrito, envíos y administradores.
 */
describe('Integración - flujo de la tienda (API + base de datos)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const sufijo = Date.now();
  const emailAdmin = `admin.${sufijo}@belissa.com`;
  const emailCliente = `valentina.rojas.${sufijo}@belissa.com`;
  const emailSegundoAdmin = `mariano.gimenez.${sufijo}@belissa.com`;
  const password = 'Belissa2026';

  let tokenAdmin: string;
  let tokenCliente: string;
  let idCategoria: number;
  let idSubcategoria: number;
  let idProducto: number;
  let idVariante: number;
  let idTarifa: number;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    // Las pruebas nunca mandan mails reales, aunque el .env local tenga el envío activado
    process.env.EMAIL_HABILITADO = 'false';
    delete process.env.BREVO_API_KEY;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cuentas y roles', () => {
    it('registra una administradora, la promueve y obtiene su token', async () => {
      await http().post('/auth/registro').send({ nombre: 'Carla', apellido: 'Méndez', email: emailAdmin, password }).expect(201);
      await ds.getRepository(Usuario).update({ email: emailAdmin }, { rol: RolUsuario.ADMINISTRADOR });
      const res = await http().post('/auth/login').send({ email: emailAdmin, password }).expect(201);
      tokenAdmin = res.body.access_token;
      expect(res.body.usuario.rol).toBe('administrador');
    });

    it('registra a una clienta con rol cliente', async () => {
      const res = await http()
        .post('/auth/registro')
        .send({ nombre: 'Valentina', apellido: 'Rojas', email: emailCliente, password })
        .expect(201);
      tokenCliente = res.body.access_token;
      expect(res.body.usuario.rol).toBe('cliente');
    });

    it('rechaza un login con contraseña incorrecta', async () => {
      await http().post('/auth/login').send({ email: emailCliente, password: 'incorrecta' }).expect(401);
    });

    it('devuelve el perfil con un token válido y 401 sin token', async () => {
      const res = await http().get('/auth/perfil').set(auth(tokenCliente)).expect(200);
      expect(res.body.email).toBe(emailCliente);
      await http().get('/auth/perfil').expect(401);
    });
  });

  describe('Seguridad por rol', () => {
    it('una clienta no puede crear categorías (403)', async () => {
      await http().post('/categorias').set(auth(tokenCliente)).send({ nombre: 'Anillos' }).expect(403);
    });

    it('sin token no se puede crear una categoría (401)', async () => {
      await http().post('/categorias').send({ nombre: 'Anillos' }).expect(401);
    });

    it('una clienta no puede ver la lista de administradores (403)', async () => {
      await http().get('/administradores').set(auth(tokenCliente)).expect(403);
    });
  });

  describe('Catálogo (administradora)', () => {
    it('crea una categoría', async () => {
      const res = await http()
        .post('/categorias')
        .set(auth(tokenAdmin))
        .send({ nombre: `Anillos ${sufijo}`, descripcion: 'Anillos de plata y oro' })
        .expect(201);
      idCategoria = res.body.id_categoria;
      expect(idCategoria).toBeDefined();
    });

    it('la categoría aparece en el listado público', async () => {
      const res = await http().get('/categorias').expect(200);
      expect(res.body.some((c: any) => c.id_categoria === idCategoria)).toBe(true);
    });

    it('crea un producto y una variante con stock', async () => {
      const sub = await ds.getRepository(Subcategoria).save({ id_categoria: idCategoria, nombre: `Solitarios ${sufijo}` } as any);
      idSubcategoria = (sub as any).id_subcategoria;

      const prod = await http()
        .post('/productos')
        .set(auth(tokenAdmin))
        .send({ id_subcategoria: idSubcategoria, nombre: 'Anillo solitario plata 925', descripcion: 'Con circonia de 4 mm' })
        .expect(201);
      idProducto = prod.body.id_producto;

      const varnt = await http()
        .post('/variantes')
        .set(auth(tokenAdmin))
        .send({ id_producto: idProducto, precio_venta: 48900, stock_disponible: 3 })
        .expect(201);
      idVariante = varnt.body.id_variante;
      expect(Number(varnt.body.precio_venta)).toBe(48900);
    });

    it('rechaza una variante con precio negativo (validación)', async () => {
      await http()
        .post('/variantes')
        .set(auth(tokenAdmin))
        .send({ id_producto: idProducto, precio_venta: -10 })
        .expect(400);
    });

    it('el producto se puede consultar públicamente', async () => {
      const res = await http().get(`/productos/${idProducto}`).expect(200);
      expect(res.body.nombre).toBe('Anillo solitario plata 925');
    });
  });

  describe('Carrito (clienta)', () => {
    it('exige estar autenticada', async () => {
      await http().get('/carrito').expect(401);
    });

    it('agrega 2 anillos y calcula el subtotal', async () => {
      await http().post('/carrito/item').set(auth(tokenCliente)).send({ id_variante: idVariante, cantidad: 2 }).expect(201);
      const res = await http().get('/carrito').set(auth(tokenCliente)).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(Number(res.body.subtotal ?? res.body.precio_subtotal)).toBe(97800);
    });

    it('no deja superar el stock disponible (3 unidades)', async () => {
      await http().post('/carrito/item').set(auth(tokenCliente)).send({ id_variante: idVariante, cantidad: 5 }).expect(400);
    });

    it('rechaza una cantidad inválida', async () => {
      await http().post('/carrito/item').set(auth(tokenCliente)).send({ id_variante: idVariante, cantidad: 0 }).expect(400);
    });

    it('elimina el ítem y deja el carrito vacío', async () => {
      await http().delete(`/carrito/item/${idVariante}`).set(auth(tokenCliente)).expect(200);
      const res = await http().get('/carrito').set(auth(tokenCliente)).expect(200);
      expect(res.body.items).toHaveLength(0);
    });
  });

  describe('Envíos y auditoría de tarifas', () => {
    it('lista las provincias públicas y las tarifas solo para administradores', async () => {
      const prov = await ds.getRepository(Provincia).save({ nombre: `Córdoba ${sufijo}` } as any);
      const tarifa = await ds
        .getRepository(TarifaEnvio)
        .save({ id_provincia: (prov as any).id_provincia, precio: 5800, plazo_dias: 3, activa: true } as any);
      idTarifa = (tarifa as any).id_tarifa;

      await http().get('/envios/provincias').expect(200);
      await http().get('/envios/tarifas').set(auth(tokenCliente)).expect(403);
      const res = await http().get('/envios/tarifas').set(auth(tokenAdmin)).expect(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('actualiza una tarifa y queda registrada en la auditoría', async () => {
      await http().patch(`/envios/tarifas/${idTarifa}`).set(auth(tokenAdmin)).send({ precio: 6400 }).expect(200);
      const filas = await ds.query(
        `SELECT accion, datos_anteriores, datos_nuevos FROM log_auditoria WHERE entidad ILIKE '%tarifa%' AND id_entidad = $1 ORDER BY id_log DESC LIMIT 1`,
        [idTarifa],
      );
      expect(filas).toHaveLength(1);
      expect(JSON.stringify(filas[0].datos_nuevos)).toContain('6400');
    });

    it('rechaza un precio negativo', async () => {
      await http().patch(`/envios/tarifas/${idTarifa}`).set(auth(tokenAdmin)).send({ precio: -1 }).expect(400);
    });
  });

  describe('Administradores', () => {
    it('solo el administrador principal puede agregar administradores', async () => {
      await http()
        .post('/auth/registro')
        .send({ nombre: 'Mariano', apellido: 'Giménez', email: emailSegundoAdmin, password })
        .expect(201);

      // El principal es el administrador más antiguo: si la base ya tenía otros, el actor no es el principal.
      const res = await http().get('/administradores').set(auth(tokenAdmin)).expect(200);
      if (res.body.puede_gestionar) {
        await http().post('/administradores').set(auth(tokenAdmin)).send({ email: emailSegundoAdmin }).expect(201);
        const rol = await ds.getRepository(Usuario).findOneBy({ email: emailSegundoAdmin });
        expect(rol?.rol).toBe(RolUsuario.ADMINISTRADOR);
      } else {
        await http().post('/administradores').set(auth(tokenAdmin)).send({ email: emailSegundoAdmin }).expect(403);
      }
    });
  });
});
