import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegistroDto {
  @IsString()
  nombre: string;

  @IsString()
  apellido: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}