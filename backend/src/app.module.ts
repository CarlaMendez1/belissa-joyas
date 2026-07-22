import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioModule } from './usuario/usuario.module.js';
import { CategoriaModule } from './categoria/categoria.module.js';
import { SubcategoriaModule } from './subcategoria/subcategoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductoModule } from './producto/producto.module.js';
import { VarianteModule } from './variante/variante.module.js';
import { OpcionModule } from './opcion/opcion.module.js';
import { CaracteristicaModule } from './caracteristica/caracteristica.module.js';
import { CarritoModule } from './carrito/carrito.module.js';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host:     config.get<string>('DB_HOST'),
        port:     config.get<number>('DB_PORT'),
        database: config.get<string>('DB_NAME'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        entities:    [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        logging: true,
      }),
    }),
    UsuarioModule,
    CategoriaModule,
    SubcategoriaModule,
    AuthModule,
    ProductoModule,
    VarianteModule,
    OpcionModule,
    CaracteristicaModule,
    CarritoModule
  ],
})
export class AppModule {}