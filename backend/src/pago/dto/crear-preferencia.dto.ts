import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class CrearPreferenciaDto {
  @IsIn(['domicilio', 'retiro'])
  tipo_entrega: 'domicilio' | 'retiro';

  // Obligatoria si la entrega es a domicilio
  @IsOptional() @IsInt() @Min(1)
  id_direccion?: number;
}
