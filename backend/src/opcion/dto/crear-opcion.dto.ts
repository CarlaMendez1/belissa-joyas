import { IsString, MaxLength } from 'class-validator';

export class CrearOpcionDto {
  @IsString()
  @MaxLength(80)
  nombre: string;
}