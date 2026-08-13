import { IsInt, IsString, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearProductoDto {
  @IsInt()
  @Type(() => Number)
  id_subcategoria: number;

  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
