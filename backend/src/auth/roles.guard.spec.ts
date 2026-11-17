import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';

// Controladores de ejemplo: el rol exigido puede estar en la clase o en el método
@Roles('administrador')
class ControladorSoloAdmin {
  listar() {}
}
class ControladorMixto {
  publico() {}
  @Roles('administrador')
  soloAdmin() {}
}

const contexto = (clase: any, metodo: string, user?: any): ExecutionContext =>
  ({
    getHandler: () => clase.prototype[metodo],
    getClass: () => clase,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('un administrador accede a un controlador marcado a nivel de clase', () => {
    expect(guard.canActivate(contexto(ControladorSoloAdmin, 'listar', { rol: 'administrador' }))).toBe(true);
  });

  it('una clienta NO accede a un controlador marcado a nivel de clase', () => {
    expect(guard.canActivate(contexto(ControladorSoloAdmin, 'listar', { rol: 'cliente' }))).toBe(false);
  });

  it('un método sin @Roles en un controlador sin rol de clase es accesible', () => {
    expect(guard.canActivate(contexto(ControladorMixto, 'publico', { rol: 'cliente' }))).toBe(true);
  });

  it('un método con @Roles bloquea a la clienta y deja pasar a la administradora', () => {
    expect(guard.canActivate(contexto(ControladorMixto, 'soloAdmin', { rol: 'cliente' }))).toBe(false);
    expect(guard.canActivate(contexto(ControladorMixto, 'soloAdmin', { rol: 'administrador' }))).toBe(true);
  });

  it('sin usuario autenticado deniega el acceso', () => {
    expect(guard.canActivate(contexto(ControladorSoloAdmin, 'listar', undefined))).toBe(false);
  });
});
