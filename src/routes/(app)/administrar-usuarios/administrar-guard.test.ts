import { describe, expect, it, vi } from 'vitest';

const requireAdminMock = vi.fn();
const innerJoinMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
const setMock = vi.fn().mockReturnValue({ where: vi.fn() });

vi.mock('$lib/server/permissions', () => ({
	requireAdmin: requireAdminMock
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ innerJoin: innerJoinMock }) }),
		update: () => ({ set: setMock })
	}
}));

const { load, actions } = await import('./+page.server');

function fakeEvent(isAdmin: boolean, formEntries: Record<string, string> = {}, callerId = 'user-1') {
	requireAdminMock.mockResolvedValue(isAdmin);
	return {
		locals: { user: { id: callerId } },
		request: {
			formData: async () => {
				const fd = new FormData();
				for (const [k, v] of Object.entries(formEntries)) fd.set(k, v);
				return fd;
			}
		}
	} as never;
}

describe('/(app)/administrar-usuarios — solo admin (T13)', () => {
	it('load redirige a un no-admin fuera de la página', async () => {
		await expect(load(fakeEvent(false))).rejects.toMatchObject({ status: 302 });
	});

	it('load deja pasar a un admin', async () => {
		await expect(load(fakeEvent(true))).resolves.toMatchObject({ usuarios: [] });
	});

	it('la action actualizar rechaza a un no-admin', async () => {
		const result = await actions.actualizar(fakeEvent(false, { userId: 'user-2' }));
		expect(result).toMatchObject({ status: 403 });
	});

	it('la action actualizar rechaza sin userId', async () => {
		const result = await actions.actualizar(fakeEvent(true, {}));
		expect(result).toMatchObject({ status: 400 });
	});

	it('la action actualizar acepta a un admin editando a otro usuario', async () => {
		const result = await actions.actualizar(
			fakeEvent(true, { userId: 'user-2', esVendedor: 'on' })
		);
		expect(result).toEqual({ actualizado: true });
	});

	it('un admin no puede quitarse su propio flag de admin', async () => {
		const result = await actions.actualizar(
			fakeEvent(true, { userId: 'user-1', esVendedor: 'on' }, 'user-1')
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('un admin sí puede mantenerse a sí mismo como admin', async () => {
		const result = await actions.actualizar(
			fakeEvent(true, { userId: 'user-1', esAdmin: 'on' }, 'user-1')
		);
		expect(result).toEqual({ actualizado: true });
	});
});
