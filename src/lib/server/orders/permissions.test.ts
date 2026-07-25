import { describe, expect, it } from 'vitest';
import type { Permisos } from '$lib/server/permissions';
import {
	puedeCrearOrden,
	puedeEditarDatosGenerales,
	puedeTomar,
	puedeDevolver
} from './permissions';

const ADMIN: Permisos = { esVendedor: false, esAdmin: true, aprobado: true };
const ADMIN_Y_VENDEDOR: Permisos = { esVendedor: true, esAdmin: true, aprobado: true };
const VENDEDOR: Permisos = { esVendedor: true, esAdmin: false, aprobado: true };
const PRODUCCION: Permisos = { esVendedor: false, esAdmin: false, aprobado: true };

function baseOrder(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		vendedorId: 'vendedor-1',
		areasSeleccionadas: ['diseño', 'impresion', 'corte'],
		areaActual: 'diseño',
		responsableActual: null,
		estado: 'en_producción',
		estadoCobro: 'pendiente',
		...overrides
	} as never;
}

describe('puedeCrearOrden — admin NO tiene bypass (spec: "Sí, si también es vendedor")', () => {
	it('permite a un vendedor puro', () => expect(puedeCrearOrden(VENDEDOR)).toBe(true));
	it('permite a un admin que también es vendedor', () => expect(puedeCrearOrden(ADMIN_Y_VENDEDOR)).toBe(true));
	it('rechaza a un admin puro (no vendedor)', () => expect(puedeCrearOrden(ADMIN)).toBe(false));
	it('rechaza a producción', () => expect(puedeCrearOrden(PRODUCCION)).toBe(false));
});

describe('puedeEditarDatosGenerales — "mientras nadie tomó la orden"', () => {
	it('permite al creador mientras sigue en el pool de la primera área', () => {
		const order = baseOrder({ areaActual: 'diseño', responsableActual: null });
		expect(puedeEditarDatosGenerales(order, 'vendedor-1', VENDEDOR)).toBe(true);
	});

	it('rechaza al creador una vez que alguien tomó la primera área', () => {
		const order = baseOrder({ areaActual: 'diseño', responsableActual: 'prod-1' });
		expect(puedeEditarDatosGenerales(order, 'vendedor-1', VENDEDOR)).toBe(false);
	});

	it('rechaza al creador si la orden ya avanzó de área (aunque esté libre en la pool siguiente)', () => {
		const order = baseOrder({ areaActual: 'impresion', responsableActual: null });
		expect(puedeEditarDatosGenerales(order, 'vendedor-1', VENDEDOR)).toBe(false);
	});

	it('rechaza a un vendedor que no es el creador', () => {
		const order = baseOrder({ areaActual: 'diseño', responsableActual: null });
		expect(puedeEditarDatosGenerales(order, 'vendedor-OTRO', VENDEDOR)).toBe(false);
	});

	it('permite a un admin siempre que nadie haya tomado la orden', () => {
		const order = baseOrder({ areaActual: 'diseño', responsableActual: null });
		expect(puedeEditarDatosGenerales(order, 'admin-1', ADMIN)).toBe(true);
	});
});

describe('puedeTomar / puedeDevolver — consistencia con apply-order-event', () => {
	it('puedeTomar es falso si ya hay responsable_actual', () => {
		const order = baseOrder({ responsableActual: 'prod-1' });
		expect(puedeTomar(order, PRODUCCION)).toBe(false);
	});

	it('puedeDevolver es falso en la primera área de la secuencia', () => {
		const order = baseOrder({ areaActual: 'diseño', responsableActual: 'prod-1' });
		expect(puedeDevolver(order, 'prod-1', PRODUCCION)).toBe(false);
	});

	it('puedeDevolver es verdadero desde la segunda área en adelante para el responsable', () => {
		const order = baseOrder({ areaActual: 'impresion', responsableActual: 'prod-1' });
		expect(puedeDevolver(order, 'prod-1', PRODUCCION)).toBe(true);
	});
});
