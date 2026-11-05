import { IsOptional, IsNumber, IsInt, IsBoolean, Min, Max } from 'class-validator';

export class ActualizarTarifaDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999)
  precio?: number;

  // null = sin plazo informado
  @IsOptional() @IsInt() @Min(1) @Max(60)
  plazo_dias?: number | null;

  @IsOptional() @IsBoolean()
  activa?: boolean;
}
