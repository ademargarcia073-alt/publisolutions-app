import { describe, expect, it, vi, beforeEach } from 'vitest';

const whereMock = vi.fn();
const orderByMock = vi.fn().mockResolvedValue([]);

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				leftJoin: () => ({
					where: (...args: unknown[]) => {
						whereMock(...args);
						return { orderBy: orderByMock };
					}
				})
			})
		})
	}
}));

const { load } = await import('./+page.server');

function fakeEvent(searchParams: Record<string, string>) {
	return { url: { searchParams: new URLSearchParams(searchParams) } } as never;
}

beforeEach(() => {
	whereMock.mockReset();
	orderByMock.mockClear();
});

describe('/ordenes — filtros de la query (spec: soportados desde el MVP)', () => {
	it('sin filtros, where recibe undefined (trae todas las órdenes)', async () => {
		await load(fakeEvent({}));
		expect(whereMock).toHaveBeenCalledWith(undefined);
	});

	it('con un filtro de estado, where recibe una condición (no undefined)', async () => {
		await load(fakeEvent({ estado: 'entregado' }));
		expect(whereMock).toHaveBeenCalledWith(expect.anything());
		expect(whereMock.mock.calls[0][0]).not.toBeUndefined();
	});

	it('con los 3 filtros combinados, where sigue recibiendo una condición definida', async () => {
		await load(fakeEvent({ estado: 'en_producción', area: 'corte', cliente: 'Tornillo' }));
		expect(whereMock.mock.calls[0][0]).not.toBeUndefined();
	});

	it('devuelve los filtros aplicados como page data para pre-marcar los selects', async () => {
		const result = (await load(fakeEvent({ estado: 'creada' }))) as {
			filtros: { estado?: string; area?: string; cliente?: string };
		};
		expect(result.filtros).toEqual({ estado: 'creada', area: undefined, cliente: undefined });
	});
});
