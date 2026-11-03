import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NivelVip } from './nivel-vip.entity.js';
import { NivelVipService } from './nivel-vip.service.js';
import { NivelVipController } from './nivel-vip.controller.js';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([NivelVip]), AuditoriaModule],
  providers: [NivelVipService],
  controllers: [NivelVipController],
  exports: [NivelVipService],
})
export class NivelVipModule {}
