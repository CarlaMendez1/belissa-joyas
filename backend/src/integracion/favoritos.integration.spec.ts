import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Subcategoria } from '../subcategoria/subcategoria.entity';
import { Categoria } from '../categoria/categoria.entity';
import { Producto } from '../producto/producto.entity';

/**
 * Pruebas de integración de favoritos con base de datos real.
 */
describe('Integración - favoritos (API + base de datos)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const sufijo = Date.now();
  const password = 'Belissa2026';
  let token: string;
  let tokenOtra: string;
  let idProducto: number;

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.EMAIL_HABILITADO = 'false';
    delete process.env.BREVO_API_KEY;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ds = app.get(DataSource);

    const cat = await ds.getRepository(Categoria).save(ds.getRepository(Categoria).create({ nombre: `Cat fav ${sufijo}` } as any)) as any;
    const sub = await ds.getRepository(Subcategoria).save(ds.getRepository(Subcategoria).create({ nombre: `Sub fav ${sufijo}`, id_categoria: cat.id_categoria } as any)) as any;
    const prod = await ds.getRepository(Producto).save(
      ds.getRepository(Producto).create({ id_subcategoria: sub.id_subcategoria, codigo_sku: `FAV-${sufijo}`, nombre: 'Anillo favorito' } as any),
    ) as any;
    idProducto = prod.id_producto;

    const a = await http().post('/auth/registro').send({ nombre: 'Lucía', apellido: 'Paz', email: `lucia.${sufijo}@belissa.com`, password }).expect(201);
    token = a.body.access_token;
    const b = await http().post('/auth/registro').send({ nombre: 'Sofía', apellido: 'Gil', email: `sofia.${sufijo}@belissa.com`, password }).expect(201);
    tokenOtra = b.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige sesión iniciada', async () => {
    await http().get('/favoritos').expect(401);
    await http().post(`/favoritos/${idProducto}`).expect(401);
  });

  it('agrega un producto a favoritos y lo lista', async () => {
    await http().post(`/favoritos/${idProducto}`).set(auth(token)).expect(201);
    const lista = await http().get('/favoritos').set(auth(token)).expect(200);
    expect(lista.body.map((p: any) => p.id_producto)).toContain(idProducto);
    const ids = await http().get('/favoritos/ids').set(auth(token)).expect(200);
    expect(ids.body).toContain(idProducto);
  });

  it('repetir el favorito no lo duplica', async () => {
    await http().post(`/favoritos/${idProducto}`).set(auth(token)).expect(201);
    const lista = await http().get('/favoritos').set(auth(token)).expect(200);
    expect(lista.body.filter((p: any) => p.id_producto === idProducto)).toHaveLength(1);
  });

  it('los favoritos son de cada usuaria', async () => {
    const lista = await http().get('/favoritos').set(auth(tokenOtra)).expect(200);
    expect(lista.body).toEqual([]);
  });

  it('rechaza un producto que no existe', async () => {
    await http().post('/favoritos/99999999').set(auth(token)).expect(404);
  });

  it('quita el favorito', async () => {
    await http().delete(`/favoritos/${idProducto}`).set(auth(token)).expect(200);
    const lista = await http().get('/favoritos').set(auth(token)).expect(200);
    expect(lista.body.map((p: any) => p.id_producto)).not.toContain(idProducto);
  });
});
