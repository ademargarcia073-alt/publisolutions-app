import { describe, expect, it } from 'vitest';
import { AREAS, ORDER_ESTADOS, ESTADO_COBRO, UNIDADES_DIMENSION } from './orders.schema';

describe('AREAS — secuencia fija de producción (spec sección 3)', () => {
	it('respeta el orden exacto Diseño → Impresión → Corte → Metalmecánica → Armado', () => {
		// Este orden es un invariante de negocio, no un detalle de implementación
		// — areasSeleccionadas en cada orden es siempre un subconjunto de ESTE
		// orden. Un reorder accidental acá rompe el flujo de producción entero.
		expect(AREAS).toEqual(['diseño', 'impresion', 'corte', 'metalmecanica', 'armado']);
	});
});

describe('ORDER_ESTADOS — flujo de estados (spec sección 4)', () => {
	it('incluye los 5 estados del flujo, en el orden en que ocurren', () => {
		expect(ORDER_ESTADOS).toEqual([
			'creada',
			'en_producción',
			'listo_para_entrega',
			'entregado',
			'cancelada'
		]);
	});
});

describe('ESTADO_COBRO', () => {
	it('solo admite pendiente/cobrado (spec sección 3)', () => {
		expect(ESTADO_COBRO).toEqual(['pendiente', 'cobrado']);
	});
});

describe('UNIDADES_DIMENSION', () => {
	it('incluye las 3 unidades acordadas para el campo dimension estructurado', () => {
		expect(UNIDADES_DIMENSION).toEqual(['cm', 'm', 'pulgadas']);
	});
});
