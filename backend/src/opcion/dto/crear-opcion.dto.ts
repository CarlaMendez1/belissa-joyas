import { IsString, MaxLength, IsArray, IsInt, IsOptional, IsIn, IsNotEmpty, ValidateIf } from 'class-validator';

export class CrearOpcionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @IsIn(['texto', 'numero'], { message: 'El tipo de dato debe ser "texto" o "numero"' })
  tipo_dato: 'texto' | 'numero';

  // Obligatoria solo para opciones numéricas
  @ValidateIf((o) => o.tipo_dato === 'numero')
  @IsString({ message: 'La unidad es obligatoria para opciones numéricas' })
  @IsNotEmpty({ message: 'La unidad es obligatoria para opciones numéricas' })
  @MaxLength(20)
  unidad?: string;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  categorias?: number[];
}