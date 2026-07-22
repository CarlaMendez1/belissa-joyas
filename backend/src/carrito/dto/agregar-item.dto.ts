import { IsNumber, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class AgregarItemDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  id_variante: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  cantidad: number;
}