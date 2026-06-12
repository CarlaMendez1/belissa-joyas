import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CrearCategoriaDto {
  @IsString()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}