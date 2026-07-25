import { describe, expect, it } from 'vitest';
import { orderFormSchema, devolverSchema } from './order';

function validOrder(overrides: Record<string, unknown> = {}) {
	const mañana = new Date();
	mañana.setDate(mañana.getDate() + 1);
	return {
		cliente: 'Ferretería El Tornillo',
		tipoTrabajo: 'letrero',
		descripcion: 'Letrero luminoso 2x1m',
		cantidad: 1,
		dimension: { alto: 100, ancho: 200, unidad: 'cm' },
		material: 'Acrílico',
		acabado: 'Mate',
		fechaEntregaComprometida: mañana,
		areasSeleccionadas: ['diseño', 'impresion'],
		total: 5000,
		aCuenta: 2000,
		...overrides
	};
}

describe('orderFormSchema', () => {
	it('acepta una orden válida', () => {
		expect(orderFormSchema.safeParse(validOrder()).success).toBe(true);
	});

	it('rechaza cliente vacío', () => {
		expect(orderFormSchema.safeParse(validOrder({ cliente: '  ' })).success).toBe(false);
	});

	it('rechaza cantidad <= 0', () => {
		expect(orderFormSchema.safeParse(validOrder({ cantidad: 0 })).success).toBe(false);
		expect(orderFormSchema.safeParse(validOrder({ cantidad: -1 })).success).toBe(false);
	});

	it('rechaza fecha de entrega en el pasado', () => {
		const ayer = new Date();
		ayer.setDate(ayer.getDate() - 1);
		expect(
			orderFormSchema.safeParse(validOrder({ fechaEntregaComprometida: ayer })).success
		).toBe(false);
	});

	it('acepta fecha de entrega hoy mismo', () => {
		expect(
			orderFormSchema.safeParse(validOrder({ fechaEntregaComprometida: new Date() })).success
		).toBe(true);
	});

	it('rechaza total o a_cuenta negativos', () => {
		expect(orderFormSchema.safeParse(validOrder({ total: -1 })).success).toBe(false);
		expect(orderFormSchema.safeParse(validOrder({ aCuenta: -1 })).success).toBe(false);
	});

	it('rechaza a_cuenta mayor al total', () => {
		expect(orderFormSchema.safeParse(validOrder({ total: 100, aCuenta: 200 })).success).toBe(
			false
		);
	});

	it('rechaza dimension con alto/ancho <= 0', () => {
		expect(
			orderFormSchema.safeParse(validOrder({ dimension: { alto: 0, ancho: 10, unidad: 'cm' } }))
				.success
		).toBe(false);
		expect(
			orderFormSchema.safeParse(validOrder({ dimension: { alto: 10, ancho: -5, unidad: 'cm' } }))
				.success
		).toBe(false);
	});

	it('rechaza unidad fuera del enum', () => {
		expect(
			orderFormSchema.safeParse(
				validOrder({ dimension: { alto: 10, ancho: 10, unidad: 'yardas' } })
			).success
		).toBe(false);
	});

	it('rechaza areasSeleccionadas vacío', () => {
		expect(orderFormSchema.safeParse(validOrder({ areasSeleccionadas: [] })).success).toBe(false);
	});

	it('rechaza areas repetidas', () => {
		expect(
			orderFormSchema.safeParse(validOrder({ areasSeleccionadas: ['diseño', 'diseño'] })).success
		).toBe(false);
	});

	it('rechaza areasSeleccionadas fuera de orden (spec: orden fijo de fábrica)', () => {
		expect(
			orderFormSchema.safeParse(validOrder({ areasSeleccionadas: ['corte', 'diseño'] })).success
		).toBe(false);
	});

	it('acepta un subconjunto no-contiguo que respeta el orden (ej. diseño + armado)', () => {
		expect(
			orderFormSchema.safeParse(validOrder({ areasSeleccionadas: ['diseño', 'armado'] })).success
		).toBe(true);
	});
});

describe('devolverSchema', () => {
	it('rechaza nota vacía', () => {
		expect(devolverSchema.safeParse({ nota: '' }).success).toBe(false);
		expect(devolverSchema.safeParse({ nota: '   ' }).success).toBe(false);
	});

	it('acepta una nota no vacía', () => {
		expect(devolverSchema.safeParse({ nota: 'defecto de impresión' }).success).toBe(true);
	});
});
