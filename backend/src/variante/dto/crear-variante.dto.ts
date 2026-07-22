import { IsNumber, IsPositive, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearVarianteDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  id_producto: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  precio_venta: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  stock_disponible?: number;

  @IsArray()
  @IsOptional()
  caracteristicas?: number[];
}