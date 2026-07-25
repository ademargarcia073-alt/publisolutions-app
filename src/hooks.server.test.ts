import { describe, expect, it, vi } from 'vitest';

const whereMock = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: whereMock }) })
	}
}));

const { enforceAprobadoGuard } = await import('./hooks.server');

function fakeEvent(routeId: string, user: { id: string } | undefined) {
	return {
		route: { id: routeId },
		locals: { user } as { user?: { id: string }; permisos?: unknown }
	} as never;
}

describe('enforceAprobadoGuard — Architecture Issue 1', () => {
	it('deja pasar rutas fuera de (app) sin tocar la DB', async () => {
		await enforceAprobadoGuard(fakeEvent('/login', undefined));
		expect(whereMock).not.toHaveBeenCalled();
	});

	it('redirige a /login si no hay sesión en una ruta (app)', async () => {
		await expect(
			enforceAprobadoGuard(fakeEvent('/(app)', undefined))
		).rejects.toMatchObject({ status: 302, location: '/login' });
	});

	it('redirige a /pendiente-aprobacion si aprobado=false', async () => {
		whereMock.mockResolvedValueOnce([{ esVendedor: false, esAdmin: false, aprobado: false }]);
		await expect(
			enforceAprobadoGuard(fakeEvent('/(app)', { id: 'user-1' }))
		).rejects.toMatchObject({ status: 302, location: '/pendiente-aprobacion' });
	});

	it('deja pasar y guarda locals.permisos si aprobado=true', async () => {
		whereMock.mockResolvedValueOnce([{ esVendedor: true, esAdmin: false, aprobado: true }]);
		const event = fakeEvent('/(app)/ordenes/nueva', { id: 'user-1' });
		await enforceAprobadoGuard(event);
		expect((event as { locals: { permisos?: unknown } }).locals.permisos).toEqual({
			esVendedor: true,
			esAdmin: false,
			aprobado: true
		});
	});

	it('trata "sin fila de permisos" (userPermissions faltante) igual que no-aprobado', async () => {
		whereMock.mockResolvedValueOnce([]);
		await expect(
			enforceAprobadoGuard(fakeEvent('/(app)', { id: 'user-huerfano' }))
		).rejects.toMatchObject({ status: 302, location: '/pendiente-aprobacion' });
	});
});
