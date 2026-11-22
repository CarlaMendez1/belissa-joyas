import { ArrayMaxSize, ArrayUnique, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_CARRUSEL } from '../carrusel.service.js';

export class GuardarCarruselDto {
  @IsArray()
  @ArrayMaxSize(MAX_CARRUSEL)
  @ArrayUnique()
  @IsInt({ each: true })
  @Type(() => Number)
  ids_producto: number[];
}
