import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Permisos } from '$lib/server/permissions';

const selectWhereMock = vi.fn();
const updateSetWhereMock = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({
			from: () => ({
				where: selectWhereMock,
				innerJoin: () => ({ where: () => ({ orderBy: () => [] }) })
			})
		}),
		update: () => ({ set: () => ({ where: updateSetWhereMock }) })
	}
}));

const tomarMock = vi.fn();
const completarMock = vi.fn();
const devolverMock = vi.fn();
const cancelarMock = vi.fn();
const entregarMock = vi.fn();
const cobrarMock = vi.fn();

vi.mock('$lib/server/orders/apply-order-event', () => ({
	tomar: tomarMock,
	completar: completarMock,
	devolver: devolverMock,
	cancelar: cancelarMock,
	entregar: entregarMock,
	cobrar: cobrarMock
}));

const { load, actions } = await import('./+page.server');

const VENDEDOR: Permisos = { esVendedor: true, esAdmin: false, aprobado: true };
const PRODUCCION: Permisos = { esVendedor: false, esAdmin: false, aprobado: true };

function baseOrder(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		vendedorId: 'vendedor-1',
		areasSeleccionadas: ['diseño', 'impresion'],
		areaActual: 'diseño',
		responsableActual: null,
		estado: 'en_producción',
		estadoCobro: 'pendiente',
		fechaEntregaComprometida: new Date(),
		saldo: '3000',
		...overrides
	};
}

function fakeEvent(
	permisos: Permisos,
	userId: string,
	formEntries: Record<string, string | string[]> = {}
) {
	return {
		params: { id: '1' },
		locals: { user: { id: userId }, permisos },
		request: {
			formData: async () => {
				const fd = new FormData();
				for (const [k, v] of Object.entries(formEntries)) {
					if (Array.isArray(v)) v.forEach((val) => fd.append(k, val));
					else fd.set(k, v);
				}
				return fd;
			}
		}
	} as never;
}

beforeEach(() => {
	selectWhereMock.mockReset();
	updateSetWhereMock.mockReset();
	tomarMock.mockReset();
	completarMock.mockReset();
	devolverMock.mockReset();
	cancelarMock.mockReset();
	entregarMock.mockReset();
	cobrarMock.mockReset();
});

describe('/ordenes/[id] — load computa los flags de permiso', () => {
	it('404 si la orden no existe', async () => {
		selectWhereMock.mockResolvedValueOnce([]);
		await expect(load(fakeEvent(VENDEDOR, 'vendedor-1'))).rejects.toMatchObject({ status: 404 });
	});

	it('puedeEditar=true para el creador mientras nadie tomó la orden', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder()]);
		const result = (await load(fakeEvent(VENDEDOR, 'vendedor-1'))) as {
			flags: Record<string, boolean>;
		};
		expect(result.flags.puedeEditar).toBe(true);
		expect(result.flags.puedeTomar).toBe(true); // producción es implícita — un vendedor también puede tomar
	});

	it('puedeTomar=true para producción cuando el área está libre', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder()]);
		const result = (await load(fakeEvent(PRODUCCION, 'prod-1'))) as {
			flags: Record<string, boolean>;
		};
		expect(result.flags.puedeTomar).toBe(true);
		expect(result.flags.puedeEditar).toBe(false); // producción nunca edita datos generales
	});
});

describe('/ordenes/[id] — action editar', () => {
	it('rechaza si ya no se puede editar (alguien ya tomó la orden)', async () => {
		selectWhereMock.mockResolvedValueOnce([baseOrder({ responsableActual: 'prod-1' })]);
		const result = await actions.editar(fakeEvent(VENDEDOR, 'vendedor-1'));
		expect(result).toMatchObject({ status: 403 });
		expect(updateSetWhereMock).not.toHaveBeenCalled();
	});
});

describe('/ordenes/[id] — acciones de transición delegan en apply-order-event', () => {
	it('tomar exitoso devuelve { ok: true }', async () => {
		tomarMock.mockResolvedValueOnce({ ok: true });
		const result = await actions.tomar(fakeEvent(PRODUCCION, 'prod-1'));
		expect(result).toEqual({ ok: true });
		expect(tomarMock).toHaveBeenCalledWith(1, 'prod-1', PRODUCCION);
	});

	it('tomar fallido devuelve fail(400) con el mensaje de error', async () => {
		tomarMock.mockResolvedValueOnce({ ok: false, error: 'Ya fue tomado' });
		const result = await actions.tomar(fakeEvent(PRODUCCION, 'prod-1'));
		expect(result).toMatchObject({ status: 400, data: { message: 'Ya fue tomado' } });
	});

	it('devolver pasa la nota del form a apply-order-event', async () => {
		devolverMock.mockResolvedValueOnce({ ok: true });
		await actions.devolver(fakeEvent(PRODUCCION, 'prod-1', { nota: 'defecto encontrado' }));
		expect(devolverMock).toHaveBeenCalledWith(1, 'prod-1', PRODUCCION, 'defecto encontrado');
	});

	it('devolver sin nota falla la validación antes de llamar a apply-order-event', async () => {
		const result = await actions.devolver(fakeEvent(PRODUCCION, 'prod-1', { nota: '' }));
		expect(result).toMatchObject({ status: 400 });
		expect(devolverMock).not.toHaveBeenCalled();
	});
});
