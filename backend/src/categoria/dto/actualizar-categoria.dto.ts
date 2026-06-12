import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ActualizarCategoriaDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;
}