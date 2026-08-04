import { IsInt, IsString, MaxLength } from 'class-validator';

export class CrearCaracteristicaDto {
  @IsInt()
  id_opcion: number;

  @IsString()
  @MaxLength(100)
  valor: string;
}