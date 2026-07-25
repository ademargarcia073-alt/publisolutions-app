import { db } from '$lib/server/db';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { orders } from '$lib/server/db/orders.schema';
import { orderEvents } from '$lib/server/db/order-events.schema';
import type { Permisos } from '$lib/server/permissions';
import { notifyOrderChange } from '$lib/server/push/notify';
import {
	puedeTomar,
	puedeCompletar,
	puedeDevolver,
	puedeCancelar,
	puedeEntregar,
	puedeCobrar
} from './permissions';

export type ApplyOrderEventResult = { ok: true } | { ok: false; error: string };

type OrderRow = typeof orders.$inferSelect;

type EventFields = {
	campoOArea: string;
	valorAnterior: string | null;
	valorNuevo: string | null;
	nota?: string;
};

type TransitionPlan = {
	// Re-asserta EXACTAMENTE el estado leído — es el chequeo optimista de
	// concurrencia (p. ej. "alguien más ya tomó esta orden"). Si 0 filas
	// matchean al hacer el UPDATE, alguien más cambió la orden entre la
	// lectura y la escritura.
	whereExtra: SQL;
	set: Partial<typeof orders.$inferInsert>;
	event: EventFields;
};

// Núcleo compartido por las 6 transiciones: lee la orden, valida (permiso +
// estado — vía los predicados de ./permissions, misma fuente de verdad que
// usa 2.0 para decidir qué botones mostrar) y computa la transición en JS
// (buildTransition), escribe con un UPDATE condicional con RETURNING
// (detecta condición de carrera), y solo si esa escritura afectó una fila
// inserta el evento de historial — así nunca queda un evento huérfano por
// una orden que en realidad no cambió.
//
// Precisión sobre atomicidad (ver docs/design-orden-trabajo.md): el UPDATE
// condicional en sí es atómico (Postgres garantiza el chequeo+escritura de
// una fila). El INSERT a order_events es un segundo statement, no envuelto en
// la misma transacción — neon-http no soporta transacciones interactivas con
// lecturas intermedias (ver T2), y unir ambos en una sola sentencia SQL
// (WITH ... UPDATE ... RETURNING, INSERT ... SELECT FROM esa CTE) agregaba
// fragilidad real para un beneficio marginal a este volumen (~5-10
// usuarios): en el peor caso de una falla de red exactamente entre las dos
// escrituras, se pierde una línea de historial, nunca se corrompe el estado
// de la orden ni se duplica una transición.
async function executeTransition(
	orderId: number,
	userId: string,
	buildTransition: (order: OrderRow) => TransitionPlan | { error: string }
): Promise<ApplyOrderEventResult> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
	if (!order) return { ok: false, error: 'Orden no encontrada' };

	const plan = buildTransition(order);
	if ('error' in plan) return { ok: false, error: plan.error };

	const [updated] = await db
		.update(orders)
		.set(plan.set)
		.where(and(eq(orders.id, orderId), plan.whereExtra))
		.returning({ id: orders.id });

	if (!updated) {
		return { ok: false, error: 'La orden cambió mientras tanto — refrescá e intentá de nuevo' };
	}

	await db.insert(orderEvents).values({ orderId, usuarioId: userId, ...plan.event });

	// Doble canal (spec sección 5) — best-effort, nunca revierte la
	// transición que ya se aplicó arriba (ver notify.ts).
	await notifyOrderChange(order, plan.event);

	return { ok: true };
}

// ── tomar ──────────────────────────────────────────────────────────────────
export async function tomar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	return executeTransition(orderId, userId, (order) => {
		if (!puedeTomar(order, permisos)) {
			return { error: `No se puede tomar esta orden (estado "${order.estado}" o ya tomada)` };
		}
		return {
			whereExtra: and(eq(orders.areaActual, order.areaActual!), isNull(orders.responsableActual))!,
			set: { responsableActual: userId },
			event: { campoOArea: 'responsable_actual', valorAnterior: null, valorNuevo: userId }
		};
	});
}

// ── completar ────────────────────────────────────────────────────────────────
export async function completar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	return executeTransition(orderId, userId, (order) => {
		if (!puedeCompletar(order, userId, permisos)) {
			return { error: `No se puede completar esta orden (estado "${order.estado}" o no sos el responsable)` };
		}

		const currentIndex = order.areasSeleccionadas.indexOf(order.areaActual!);
		const siguienteArea = order.areasSeleccionadas[currentIndex + 1] ?? null;

		return {
			whereExtra: and(
				eq(orders.areaActual, order.areaActual!),
				eq(orders.responsableActual, order.responsableActual!)
			)!,
			set: siguienteArea
				? { areaActual: siguienteArea, responsableActual: null }
				: { areaActual: null, responsableActual: null, estado: 'listo_para_entrega' },
			event: {
				campoOArea: 'area_actual',
				valorAnterior: order.areaActual,
				valorNuevo: siguienteArea ?? 'listo_para_entrega'
			}
		};
	});
}

// ── devolver a área anterior (extensión post-revisión, ver design doc) ──────
export async function devolver(
	orderId: number,
	userId: string,
	permisos: Permisos,
	nota: string
): Promise<ApplyOrderEventResult> {
	if (!nota.trim()) {
		return { ok: false, error: 'La nota es obligatoria para devolver a área anterior' };
	}

	return executeTransition(orderId, userId, (order) => {
		if (!puedeDevolver(order, userId, permisos)) {
			return {
				error: `No se puede devolver esta orden (estado "${order.estado}", ya en la primera área, o no sos el responsable)`
			};
		}

		const currentIndex = order.areasSeleccionadas.indexOf(order.areaActual!);
		const areaAnterior = order.areasSeleccionadas[currentIndex - 1];

		return {
			whereExtra: and(
				eq(orders.areaActual, order.areaActual!),
				eq(orders.responsableActual, order.responsableActual!)
			)!,
			set: { areaActual: areaAnterior, responsableActual: null },
			event: {
				campoOArea: 'area_actual',
				valorAnterior: order.areaActual,
				valorNuevo: areaAnterior,
				nota
			}
		};
	});
}

// ── cancelar ────────────────────────────────────────────────────────────────
export async function cancelar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	return executeTransition(orderId, userId, (order) => {
		if (!puedeCancelar(order, userId, permisos)) {
			return { error: `No se puede cancelar una orden en estado "${order.estado}", o no sos el creador` };
		}

		return {
			whereExtra: eq(orders.estado, order.estado),
			set: { estado: 'cancelada' },
			event: { campoOArea: 'estado', valorAnterior: order.estado, valorNuevo: 'cancelada' }
		};
	});
}

// ── marcar entregado ─────────────────────────────────────────────────────────
export async function entregar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	return executeTransition(orderId, userId, (order) => {
		if (!puedeEntregar(order, userId, permisos)) {
			return {
				error: `No se puede marcar entregado una orden en estado "${order.estado}", o no sos el creador`
			};
		}

		return {
			whereExtra: eq(orders.estado, 'listo_para_entrega'),
			set: { estado: 'entregado', fechaEntregaReal: new Date() },
			event: { campoOArea: 'estado', valorAnterior: 'listo_para_entrega', valorNuevo: 'entregado' }
		};
	});
}

// ── marcar cobro ─────────────────────────────────────────────────────────────
export async function cobrar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	return executeTransition(orderId, userId, (order) => {
		if (!puedeCobrar(order, permisos)) {
			return { error: 'Solo un admin puede marcar cobro de una orden entregada y aún pendiente' };
		}

		return {
			whereExtra: eq(orders.estadoCobro, 'pendiente'),
			set: { estadoCobro: 'cobrado', fechaCobro: new Date() },
			event: { campoOArea: 'estado_cobro', valorAnterior: 'pendiente', valorNuevo: 'cobrado' }
		};
	});
}
