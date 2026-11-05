import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const ESTADOS_ENVIO = ['pendiente_despacho', 'despachado', 'retiro_listo', 'entregado'] as const;
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number];

export class CambiarEstadoEnvioDto {
  @IsIn(ESTADOS_ENVIO as unknown as string[], { message: 'Estado de envío inválido' })
  estado_envio: EstadoEnvio;

  // Obligatorio al despachar un envío a domicilio (se valida en el servicio)
  @IsOptional() @IsString() @MaxLength(60)
  transportista?: string;

  @IsOptional() @IsString() @MaxLength(80)
  numero_seguimiento?: string;
}
