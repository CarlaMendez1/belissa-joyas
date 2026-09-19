import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { UsuarioModule } from './usuario/usuario.module.js';
import { CategoriaModule } from './categoria/categoria.module.js';
import { SubcategoriaModule } from './subcategoria/subcategoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductoModule } from './producto/producto.module.js';
import { VarianteModule } from './variante/variante.module.js';
import { OpcionModule } from './opcion/opcion.module.js';
import { CaracteristicaModule } from './caracteristica/caracteristica.module.js';
import { CarritoModule } from './carrito/carrito.module.js';
import { PagoModule } from './pago/pago.module.js';
import { ConfiguracionModule } from './configuracion/configuracion.module.js';
import { NotificacionModule } from './notificacion/notificacion.module.js';
import { TareasModule } from './tareas/tareas.module.js';
import { EmailModule } from './email/email.module.js';
import { NivelVipModule } from './nivel-vip/nivel-vip.module.js';
import { ClienteVipModule } from './cliente-vip/cliente-vip.module.js';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
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
    PagoModule,
    CarritoModule,
    ConfiguracionModule,
    NotificacionModule,
    TareasModule,
    EmailModule,
    NivelVipModule,
    ClienteVipModule,
  ],
})
export class AppModule {}