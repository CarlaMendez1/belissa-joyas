import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CrearProductoDto {
  @IsNumber()
  id_subcategoria: number;

  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}
