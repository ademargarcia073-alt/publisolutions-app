import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Permisos } from '$lib/server/permissions';

const insertValuesReturningMock = vi.fn();
const insertEventValuesMock = vi.fn();
const notifyOrderChangeMock = vi.fn().mockResolvedValue(undefined);

let insertCallCount = 0;
vi.mock('$lib/server/db', () => ({
	db: {
		insert: () => {
			insertCallCount++;
			// 1er insert = orders (necesita .returning()), 2do = order_events
			return insertCallCount === 1
				? { values: () => ({ returning: insertValuesReturningMock }) }
				: { values: insertEventValuesMock };
		}
	}
}));

vi.mock('$lib/server/push/notify', () => ({
	notifyOrderChange: notifyOrderChangeMock
}));

const { load, actions } = await import('./+page.server');

const VENDEDOR: Permisos = { esVendedor: true, esAdmin: false, aprobado: true };
const PRODUCCION: Permisos = { esVendedor: false, esAdmin: false, aprobado: true };
const ADMIN: Permisos = { esVendedor: false, esAdmin: true, aprobado: true };

function fakeEvent(permisos: Permisos, formEntries: Record<string, string | string[]> = {}) {
	return {
		locals: { user: { id: 'vendedor-1' }, permisos },
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

function validFormEntries(): Record<string, string | string[]> {
	const mañana = new Date();
	mañana.setDate(mañana.getDate() + 1);
	return {
		cliente: 'Ferretería El Tornillo',
		tipoTrabajo: 'letrero',
		descripcion: 'Letrero luminoso',
		cantidad: '1',
		alto: '100',
		ancho: '200',
		unidad: 'cm',
		material: 'Acrílico',
		acabado: 'Mate',
		fechaEntregaComprometida: mañana.toISOString().slice(0, 10),
		areasSeleccionadas: ['diseño', 'impresion'],
		total: '5000',
		aCuenta: '2000'
	};
}

beforeEach(() => {
	insertCallCount = 0;
	insertValuesReturningMock.mockReset();
	insertEventValuesMock.mockReset();
	notifyOrderChangeMock.mockClear();
});

describe('/ordenes/nueva — Crear orden (2.0)', () => {
	it('load redirige a producción (no puede crear)', () => {
		expect(() => load({ locals: { permisos: PRODUCCION } } as never)).toThrowError();
	});

	it('load redirige a un admin puro (spec: solo si también es vendedor)', () => {
		expect(() => load({ locals: { permisos: ADMIN } } as never)).toThrowError();
	});

	it('load deja pasar a un vendedor', () => {
		const result = load({ locals: { permisos: VENDEDOR } } as never) as {
			areas: string[];
			tiposTrabajo: string[];
		};
		expect(result.areas.length).toBeGreaterThan(0);
	});

	it('la action rechaza a producción', async () => {
		const result = await actions.default(fakeEvent(PRODUCCION, validFormEntries()));
		expect(result).toMatchObject({ status: 403 });
	});

	it('la action rechaza datos inválidos (cantidad <= 0)', async () => {
		const result = await actions.default(
			fakeEvent(VENDEDOR, { ...validFormEntries(), cantidad: '0' })
		);
		expect(result).toMatchObject({ status: 400 });
	});

	it('crea la orden, registra el evento y notifica cuando los datos son válidos', async () => {
		insertValuesReturningMock.mockResolvedValueOnce([
			{ id: 42, cliente: 'Ferretería El Tornillo', vendedorId: 'vendedor-1', areaActual: 'diseño' }
		]);

		await expect(actions.default(fakeEvent(VENDEDOR, validFormEntries()))).rejects.toMatchObject({
			status: 302,
			location: '/ordenes/42'
		});

		expect(insertEventValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: 42, valorNuevo: 'en_producción' })
		);
		expect(notifyOrderChangeMock).toHaveBeenCalledOnce();
	});
});
