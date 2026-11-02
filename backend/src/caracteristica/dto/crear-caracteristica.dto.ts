import { IsInt, IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CrearCaracteristicaDto {
  @IsInt()
  id_opcion: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  valor: string;
}