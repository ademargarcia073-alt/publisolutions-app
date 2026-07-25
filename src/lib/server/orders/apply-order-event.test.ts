import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Permisos } from '$lib/server/permissions';

const selectWhereMock = vi.fn();
const updateReturningMock = vi.fn();
const insertValuesMock = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: selectWhereMock }) }),
		update: () => ({ set: () => ({ where: () => ({ returning: updateReturningMock }) }) }),
		insert: () => ({ values: insertValuesMock })
	}
}));

// notifyOrderChange tiene su propia suite (notify.test.ts) — acá se
// no-opea para que estos tests queden enfocados en la lógica de la
// transición, sin arrastrar sus propias queries de destinatarios/push.
const notifyOrderChangeMock = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/push/notify', () => ({
	notifyOrderChange: notifyOrderChangeMock
}));

const { tomar, completar, devolver, cancelar, entregar, cobrar } = await import(
	'./apply-order-event'
);

const ADMIN: Permisos = { esVendedor: false, esAdmin: true, aprobado: true };
const VENDEDOR: Permisos = { esVendedor: true, esAdmin: false, aprobado: true };
const PRODUCCION: Permisos = { esVendedor: false, esAdmin: false, aprobado: true };

function baseOrder(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		vendedorId: 'vendedor-1',
		areasSeleccionadas: ['diseño', 'impresion', 'corte'],
		areaActual: 'impresion',
		responsableActual: 'prod-1',
		estado: 'en_producción',
		estadoCobro: 'pendiente',
		...overrides
	};
}

beforeEach(() => {
	selectWhereMock.mockReset();
	updateReturningMock.mockReset();
	insertValuesMock.mockReset();
	notifyOrderChangeMock.mockClear();
});

describe('tomar', () => {
	it('rechaza a un vendedor puro (no es producción ni admin)', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: null })]);
		const result = await tomar(1, 'v-1', VENDEDOR);
		expect(result).toEqual({ ok: false, error: expect.stringContaining('No se puede tomar') });
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('permite a producción tomar un pool libre', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: null })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);

		const result = await tomar(1, 'prod-2', PRODUCCION);

		expect(result).toEqual({ ok: true });
		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({ campoOArea: 'responsable_actual', valorNuevo: 'prod-2' })
		);
		expect(notifyOrderChangeMock).toHaveBeenCalledOnce();
	});

	it('devuelve conflicto si ya fue tomado (rowCount=0 en el UPDATE condicional)', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: null })]);
		updateReturningMock.mockResolvedValueOnce([]); // alguien más lo tomó primero

		const result = await tomar(1, 'prod-2', PRODUCCION);

		expect(result).toEqual({ ok: false, error: expect.stringContaining('cambió mientras tanto') });
		expect(insertValuesMock).not.toHaveBeenCalled();
		expect(notifyOrderChangeMock).not.toHaveBeenCalled();
	});

	it('rechaza si el estado no es en_producción', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'creada', responsableActual: null })]);
		const result = await tomar(1, 'prod-2', PRODUCCION);
		expect(result.ok).toBe(false);
	});
});

describe('completar', () => {
	it('avanza a la siguiente área cuando hay una', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder()]); // impresion, siguiente = corte
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);

		const result = await completar(1, 'prod-1', PRODUCCION);

		expect(result).toEqual({ ok: true });
		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({ valorAnterior: 'impresion', valorNuevo: 'corte' })
		);
	});

	it('pasa a listo_para_entrega cuando no hay siguiente área', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ areaActual: 'corte' })]); // última área
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);

		const result = await completar(1, 'prod-1', PRODUCCION);

		expect(result).toEqual({ ok: true });
		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({ valorNuevo: 'listo_para_entrega' })
		);
	});

	it('rechaza a alguien que no es el responsable actual ni admin', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: 'prod-1' })]);
		const result = await completar(1, 'prod-OTRO', PRODUCCION);
		expect(result.ok).toBe(false);
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('permite a un admin completar el trabajo de otra persona', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: 'prod-1' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);
		const result = await completar(1, 'admin-1', ADMIN);
		expect(result).toEqual({ ok: true });
	});
});

describe('devolver — extensión post-revisión (no estaba en el spec original)', () => {
	it('rechaza sin nota', async () => {
		const result = await devolver(1, 'prod-1', PRODUCCION, '');
		expect(result).toEqual({ ok: false, error: expect.stringContaining('nota es obligatoria') });
		expect(selectWhereMock).not.toHaveBeenCalled();
	});

	it('rechaza si el área actual es la primera de la secuencia', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ areaActual: 'diseño' })]);
		const result = await devolver(1, 'prod-1', PRODUCCION, 'defecto encontrado');
		expect(result.ok).toBe(false);
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('retrocede una posición y limpia responsable_actual', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ areaActual: 'corte', responsableActual: 'prod-1' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);

		const result = await devolver(1, 'prod-1', PRODUCCION, 'defecto de impresión');

		expect(result).toEqual({ ok: true });
		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({
				valorAnterior: 'corte',
				valorNuevo: 'impresion',
				nota: 'defecto de impresión'
			})
		);
	});

	it('rechaza a alguien que no tiene el trabajo ni es admin', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: 'prod-1' })]);
		const result = await devolver(1, 'prod-OTRO', PRODUCCION, 'motivo');
		expect(result.ok).toBe(false);
	});
});

describe('cancelar', () => {
	it('permite al vendedor creador cancelar desde creada', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'creada' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);
		const result = await cancelar(1, 'vendedor-1', VENDEDOR);
		expect(result).toEqual({ ok: true });
	});

	it('rechaza desde listo_para_entrega en adelante', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'listo_para_entrega' })]);
		const result = await cancelar(1, 'vendedor-1', VENDEDOR);
		expect(result.ok).toBe(false);
	});

	it('rechaza a un vendedor que no es el creador', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'creada', vendedorId: 'vendedor-1' })]);
		const result = await cancelar(1, 'vendedor-OTRO', VENDEDOR);
		expect(result.ok).toBe(false);
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('permite a un admin cancelar aunque no sea el creador', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'en_producción', vendedorId: 'vendedor-1' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);
		const result = await cancelar(1, 'admin-1', ADMIN);
		expect(result).toEqual({ ok: true });
	});
});

describe('entregar', () => {
	it('permite al creador marcar entregado desde listo_para_entrega', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'listo_para_entrega' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);
		const result = await entregar(1, 'vendedor-1', VENDEDOR);
		expect(result).toEqual({ ok: true });
	});

	it('rechaza si el estado no es listo_para_entrega', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'en_producción' })]);
		const result = await entregar(1, 'vendedor-1', VENDEDOR);
		expect(result.ok).toBe(false);
	});
});

describe('cobrar', () => {
	it('rechaza a cualquiera que no sea admin', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'entregado', estadoCobro: 'pendiente' })]);
		const result = await cobrar(1, 'vendedor-1', VENDEDOR);
		expect(result).toEqual({ ok: false, error: expect.stringContaining('Solo un admin') });
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('rechaza si la orden no está entregada', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'listo_para_entrega' })]);
		const result = await cobrar(1, 'admin-1', ADMIN);
		expect(result.ok).toBe(false);
	});

	it('rechaza si ya fue marcada como cobrada', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'entregado', estadoCobro: 'cobrado' })]);
		const result = await cobrar(1, 'admin-1', ADMIN);
		expect(result.ok).toBe(false);
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it('marca cobrado cuando la orden está entregada y pendiente', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ estado: 'entregado', estadoCobro: 'pendiente' })]);
		updateReturningMock.mockResolvedValueOnce([{ id: 1 }]);
		const result = await cobrar(1, 'admin-1', ADMIN);
		expect(result).toEqual({ ok: true });
	});
});
