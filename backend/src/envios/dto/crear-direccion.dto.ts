import {
  IsString, IsOptional, IsInt, IsBoolean, IsNotEmpty, MaxLength, Matches, Min,
} from 'class-validator';

export class CrearDireccionDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  nombre_destinatario: string;

  @IsString() @MaxLength(30)
  @Matches(/^[0-9 +()-]+$/, { message: 'El teléfono solo puede tener números, espacios, + - ( )' })
  telefono: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  calle: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  numero: string;

  @IsOptional() @IsString() @MaxLength(30)
  piso_depto?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  localidad: string;

  @IsInt() @Min(1)
  id_provincia: number;

  @IsString()
  @Matches(/^([0-9]{4}|[A-Za-z][0-9]{4}[A-Za-z]{3})$/, {
    message: 'Código postal inválido (ej: 1425 o C1425ABC)',
  })
  codigo_postal: string;

  @IsOptional() @IsString() @MaxLength(255)
  observaciones?: string;

  @IsOptional() @IsBoolean()
  es_predeterminada?: boolean;
}
