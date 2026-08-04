import { PartialType } from '@nestjs/mapped-types';
import { CrearOpcionDto } from './crear-opcion.dto.js';

export class ActualizarOpcionDto extends PartialType(CrearOpcionDto) {}