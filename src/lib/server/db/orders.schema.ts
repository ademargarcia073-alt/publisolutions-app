import { sql } from 'drizzle-orm';
import {
	pgTable,
	serial,
	text,
	integer,
	numeric,
	timestamp,
	index
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// Secuencia fija de áreas de producción (spec sección 3 — "orden fijo de
// fábrica"). `areasSeleccionadas` en cada orden es siempre un subconjunto
// ORDENADO de esta lista, nunca un orden distinto por orden de trabajo
// (docs/design-orden-trabajo.md).
export const AREAS = ['diseño', 'impresion', 'corte', 'metalmecanica', 'armado'] as const;
export type Area = (typeof AREAS)[number];

// Plain text + app-level allowed set (no pg enum) — mismo patrón que
// ORDER_STATUSES en lavanderia-app-generica: agregar un estado nuevo no pide
// una migración.
export const ORDER_ESTADOS = [
	'creada',
	'en_producción',
	'listo_para_entrega',
	'entregado',
	'cancelada'
] as const;
export type OrderEstado = (typeof ORDER_ESTADOS)[number];

export const ESTADO_COBRO = ['pendiente', 'cobrado'] as const;
export type EstadoCobro = (typeof ESTADO_COBRO)[number];

export const UNIDADES_DIMENSION = ['cm', 'm', 'pulgadas'] as const;
export type UnidadDimension = (typeof UNIDADES_DIMENSION)[number];

// tipo_trabajo (spec: "lista desplegable") — el cliente todavía no dio la
// lista real de tipos de trabajo. Placeholder editable de una línea; cambiar
// este array no pide migración (mismo patrón app-level que ORDER_ESTADOS).
// TODO: reemplazar con la lista real del cliente antes de ir a producción.
export const TIPOS_TRABAJO = ['letrero', 'gigantografia', 'vinilo', 'otro'] as const;
export type TipoTrabajo = (typeof TIPOS_TRABAJO)[number];

export const orders = pgTable('orders', {
	id: serial('id').primaryKey(),

	// ── Datos generales (vendedor, al crear) ──────────────────────────────
	fechaCreacion: timestamp('fecha_creacion').defaultNow().notNull(),
	cliente: text('cliente').notNull(),
	tipoTrabajo: text('tipo_trabajo').notNull().$type<TipoTrabajo>(),
	descripcion: text('descripcion').notNull(),
	cantidad: integer('cantidad').notNull(),
	// Dimensión estructurada (decisión post-revisión — no estaba en el spec
	// original, que solo tenía un campo `dimension`). Ver design doc.
	alto: numeric('alto', { precision: 10, scale: 2 }).notNull(),
	ancho: numeric('ancho', { precision: 10, scale: 2 }).notNull(),
	unidad: text('unidad').notNull().$type<UnidadDimension>(),
	material: text('material').notNull(),
	acabado: text('acabado').notNull(),
	arte: text('arte'),
	fechaEntregaComprometida: timestamp('fecha_entrega_comprometida').notNull(),
	vendedorId: text('vendedor_id')
		.notNull()
		.references(() => user.id),

	// ── Áreas de producción ────────────────────────────────────────────────
	// Subconjunto ORDENADO de AREAS. Postgres native array de text; el orden
	// del array ES el orden de producción de esta orden (no alfabético).
	areasSeleccionadas: text('areas_seleccionadas').array().notNull().$type<Area[]>(),

	// ── Financiero ──────────────────────────────────────────────────────────
	total: numeric('total', { precision: 12, scale: 2 }).notNull(),
	aCuenta: numeric('a_cuenta', { precision: 12, scale: 2 }).notNull().default('0'),
	// Columna generada por Postgres — estructuralmente imposible de editar a
	// mano (spec: "calculado automáticamente... no editable a mano").
	saldo: numeric('saldo', { precision: 12, scale: 2 }).generatedAlwaysAs(
		() => sql`(total - a_cuenta)`
	),
	estadoCobro: text('estado_cobro').notNull().default('pendiente').$type<EstadoCobro>(),
	fechaCobro: timestamp('fecha_cobro'),

	// ── Automáticos / derivados ─────────────────────────────────────────────
	// null cuando no queda ningún área pendiente (listo_para_entrega en
	// adelante) o cuando la orden fue cancelada antes de tomar la primera área.
	areaActual: text('area_actual').$type<Area>(),
	estado: text('estado').notNull().default('creada').$type<OrderEstado>(),
	// null mientras está en pool (nadie la tomó todavía en areaActual).
	responsableActual: text('responsable_actual').references(() => user.id),
	fechaEntregaReal: timestamp('fecha_entrega_real'),

	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
}, (table) => [
	// Sirve el query del dashboard (1.0 — Performance Issue 5: tablero
	// filtrado por área/estado sin escanear toda la tabla) y los filtros de
	// 3.0 diferidos en UI pero ya contemplados en el diseño de la query.
	index('orders_estado_idx').on(table.estado),
	index('orders_area_actual_idx').on(table.areaActual)
]);

// Relaciones cruzadas (orders ↔ order_events ↔ user) viven en relations.ts,
// no acá — evita el ciclo de imports entre orders.schema y
// order-events.schema (cada archivo de tabla solo define su propio pgTable).
