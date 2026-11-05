import { PartialType } from '@nestjs/mapped-types';
import { CrearDireccionDto } from './crear-direccion.dto.js';

export class ActualizarDireccionDto extends PartialType(CrearDireccionDto) {}
