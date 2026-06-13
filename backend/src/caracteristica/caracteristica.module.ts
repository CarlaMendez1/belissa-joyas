import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caracteristica } from './caracteristica.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Caracteristica])],
  exports: [TypeOrmModule],
})
export class CaracteristicaModule {}