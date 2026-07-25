import { db } from '$lib/server/db';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { orders, type OrderEstado } from '$lib/server/db/orders.schema';
import { orderEvents } from '$lib/server/db/order-events.schema';
import type { Permisos } from '$lib/server/permissions';
import { notifyOrderChange } from '$lib/server/push/notify';

export type ApplyOrderEventResult = { ok: true } | { ok: false; error: string };

type OrderRow = typeof orders.$inferSelect;

// "Producción" no es un flag propio — todo usuario aprobado que no es
// vendedor ni admin es, por definición, producción (spec sección 2,
// docs/design-orden-trabajo.md).
function isProduccion(permisos: Permisos): boolean {
	return permisos.aprobado && !permisos.esVendedor && !permisos.esAdmin;
}

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
// estado) y computa la transición en JS (buildTransition), escribe con un
// UPDATE condicional con RETURNING (detecta condición de carrera), y solo si
// esa escritura afectó una fila inserta el evento de historial — así nunca
// queda un evento huérfano por una orden que en realidad no cambió.
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

function estadoInvalidoError(estado: OrderEstado, accion: string): { error: string } {
	return { error: `No se puede ${accion} una orden en estado "${estado}"` };
}

// ── tomar ──────────────────────────────────────────────────────────────────
export async function tomar(
	orderId: number,
	userId: string,
	permisos: Permisos
): Promise<ApplyOrderEventResult> {
	if (!(permisos.esAdmin || isProduccion(permisos))) {
		return { ok: false, error: 'No autorizado para tomar trabajos de producción' };
	}

	return executeTransition(orderId, userId, (order) => {
		if (order.estado !== 'en_producción' || !order.areaActual) {
			return estadoInvalidoError(order.estado, 'tomar');
		}
		return {
			whereExtra: and(eq(orders.areaActual, order.areaActual), isNull(orders.responsableActual))!,
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
		if (!(permisos.esAdmin || order.responsableActual === userId)) {
			return { error: 'Solo quien tomó el trabajo (o un admin) puede completarlo' };
		}
		if (order.estado !== 'en_producción' || !order.areaActual) {
			return estadoInvalidoError(order.estado, 'completar');
		}

		const currentIndex = order.areasSeleccionadas.indexOf(order.areaActual);
		const siguienteArea = order.areasSeleccionadas[currentIndex + 1] ?? null;

		return {
			whereExtra: and(
				eq(orders.areaActual, order.areaActual),
				eq(orders.responsableActual, userId)
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
		if (!(permisos.esAdmin || order.responsableActual === userId)) {
			return { error: 'Solo quien tiene el trabajo (o un admin) puede devolverlo' };
		}
		if (order.estado !== 'en_producción' || !order.areaActual) {
			return estadoInvalidoError(order.estado, 'devolver');
		}

		const currentIndex = order.areasSeleccionadas.indexOf(order.areaActual);
		if (currentIndex <= 0) {
			return { error: 'No hay un área anterior a la cual devolver' };
		}
		const areaAnterior = order.areasSeleccionadas[currentIndex - 1];

		return {
			whereExtra: and(
				eq(orders.areaActual, order.areaActual),
				eq(orders.responsableActual, userId)
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
		const esCreador = permisos.esVendedor && order.vendedorId === userId;
		if (!(permisos.esAdmin || esCreador)) {
			return { error: 'Solo el vendedor creador (o un admin) puede cancelar' };
		}
		if (order.estado !== 'creada' && order.estado !== 'en_producción') {
			return estadoInvalidoError(order.estado, 'cancelar');
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
		const esCreador = permisos.esVendedor && order.vendedorId === userId;
		if (!(permisos.esAdmin || esCreador)) {
			return { error: 'Solo el vendedor creador (o un admin) puede marcar entregado' };
		}
		if (order.estado !== 'listo_para_entrega') {
			return estadoInvalidoError(order.estado, 'marcar entregado');
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
	if (!permisos.esAdmin) {
		return { ok: false, error: 'Solo un admin puede marcar cobro' };
	}

	return executeTransition(orderId, userId, (order) => {
		if (order.estado !== 'entregado') {
			return { error: 'Solo se puede marcar cobro de una orden ya entregada' };
		}
		if (order.estadoCobro === 'cobrado') {
			return { error: 'Esta orden ya fue marcada como cobrada' };
		}

		return {
			whereExtra: eq(orders.estadoCobro, 'pendiente'),
			set: { estadoCobro: 'cobrado', fechaCobro: new Date() },
			event: { campoOArea: 'estado_cobro', valorAnterior: 'pendiente', valorNuevo: 'cobrado' }
		};
	});
}
