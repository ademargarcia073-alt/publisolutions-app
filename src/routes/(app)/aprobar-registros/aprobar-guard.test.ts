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

function fakeEvent(isAdmin: boolean, formEntries: Record<string, string> = {}) {
	requireAdminMock.mockResolvedValue(isAdmin);
	return {
		locals: { user: { id: 'user-1' } },
		request: {
			formData: async () => {
				const fd = new FormData();
				for (const [k, v] of Object.entries(formEntries)) fd.set(k, v);
				return fd;
			}
		}
	} as never;
}

describe('/(app)/aprobar-registros — solo admin (spec sección 2)', () => {
	it('load redirige a un no-admin fuera de la página', async () => {
		await expect(load(fakeEvent(false))).rejects.toMatchObject({ status: 302 });
	});

	it('load deja pasar a un admin', async () => {
		await expect(load(fakeEvent(true))).resolves.toMatchObject({ pendientes: [] });
	});

	it('la action aprobar rechaza a un no-admin', async () => {
		const result = await actions.aprobar(fakeEvent(false, { userId: 'user-2' }));
		expect(result).toMatchObject({ status: 403 });
	});

	it('la action aprobar rechaza sin userId', async () => {
		const result = await actions.aprobar(fakeEvent(true, {}));
		expect(result).toMatchObject({ status: 400 });
	});

	it('la action aprobar acepta a un admin con userId', async () => {
		const result = await actions.aprobar(fakeEvent(true, { userId: 'user-2' }));
		expect(result).toEqual({ aprobado: true });
	});
});
