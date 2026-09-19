import { IsString, MaxLength, IsArray, IsInt, IsOptional } from 'class-validator';

export class CrearOpcionDto {
  @IsString()
  @MaxLength(80)
  nombre: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categorias?: number[];
}