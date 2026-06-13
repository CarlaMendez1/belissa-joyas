import { IsNumber, IsArray, IsOptional, Min } from 'class-validator';

export class CrearVarianteDto {
  @IsNumber()
  id_producto: number;

  @IsNumber()
  @Min(0)
  precio_venta: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock_disponible?: number;

  @IsArray()
  @IsOptional()
  caracteristicas?: number[]; // IDs de características
}