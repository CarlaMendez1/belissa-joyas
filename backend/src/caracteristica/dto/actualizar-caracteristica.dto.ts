import { PartialType } from '@nestjs/mapped-types';
import { CrearCaracteristicaDto } from './crear-caracteristica.dto.js';

export class ActualizarCaracteristicaDto extends PartialType(CrearCaracteristicaDto) {}