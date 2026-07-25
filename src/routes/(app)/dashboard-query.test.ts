import { describe, expect, it, vi } from 'vitest';

// Mock chainable que soporta la cadena select().from().leftJoin().leftJoin().where().orderBy()
// y select().from().innerJoin().where() — sin importar el orden de los
// metodos encadenados, siempre devuelve `this` hasta que se hace `await`
// (Drizzle's query builder es "thenable").
function makeChainable(result: unknown[]) {
	const chain: Record<string, unknown> = {
		from: () => chain,
		leftJoin: () => chain,
		innerJoin: () => chain,
		where: () => chain,
		orderBy: () => chain,
		then: (resolve: (v: unknown[]) => void) => resolve(result)
	};
	return chain;
}

const TABLERO_ROW = (id: number, responsableActualId: string | null) => ({
	id,
	cliente: `Cliente ${id}`,
	areaActual: 'corte',
	estado: 'en_producción',
	responsableActualId,
	vendedorNombre: 'Vendedor Uno',
	responsableNombre: responsableActualId ? 'Prod Uno' : null
});

let selectCallCount = 0;
const selectMock = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		select: (...args: unknown[]) => selectMock(...args)
	}
}));

const { load } = await import('./+page.server');

describe('Dashboard (1.0) — Performance Issue 5: sin N+1', () => {
	it('hace exactamente 2 queries (tablero + producción), sin importar cuántas órdenes haya', async () => {
		selectCallCount = 0;
		selectMock.mockImplementation(() => {
			selectCallCount++;
			if (selectCallCount === 1) {
				// 50 órdenes activas, ninguna N+1 — todo viene de esta única query
				const rows = Array.from({ length: 50 }, (_, i) => TABLERO_ROW(i + 1, i % 2 === 0 ? 'prod-1' : null));
				return makeChainable(rows);
			}
			return makeChainable([
				{ userId: 'prod-1', nombre: 'Prod Uno' },
				{ userId: 'prod-2', nombre: 'Prod Dos' }
			]);
		});

		const result = (await load({} as never)) as { tablero: unknown[]; produccionLibre: unknown[] };

		expect(selectCallCount).toBe(2);
		expect(result.tablero).toHaveLength(50);
	});

	it('produccionLibre excluye a quien ya tiene una orden asignada', async () => {
		selectMock
			.mockImplementationOnce(() =>
				makeChainable([TABLERO_ROW(1, 'prod-1')])
			)
			.mockImplementationOnce(() =>
				makeChainable([
					{ userId: 'prod-1', nombre: 'Prod Uno' },
					{ userId: 'prod-2', nombre: 'Prod Dos' }
				])
			);

		const result = (await load({} as never)) as { tablero: unknown[]; produccionLibre: unknown[] };

		expect(result.produccionLibre).toEqual([{ userId: 'prod-2', nombre: 'Prod Dos' }]);
	});
});
