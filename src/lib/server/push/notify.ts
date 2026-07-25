import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { orders } from '$lib/server/db/orders.schema';
import { userPermissions } from '$lib/server/db/permissions.schema';
import { notifications } from '$lib/server/db/notifications.schema';
import { sendPushToUser } from './send';

type OrderRow = typeof orders.$inferSelect;
type EventFields = { campoOArea: string; valorAnterior: string | null; valorNuevo: string | null };

// Doble canal, mismo evento dispara ambos (spec sección 5): push nativo +
// registro en 1.1. Broadcast a todo el grupo de producción (sin filtrar por
// área) + el vendedor dueño de la orden — literal del spec, sin excluir a
// quien acaba de hacer la acción. "Producción" es implícito para todo
// aprobado (spec sección 2) — un vendedor o admin que también hace piso
// recibe el broadcast igual, no solo su propia notificación de vendedor.
async function getRecipients(vendedorId: string): Promise<string[]> {
	const produccion = await db
		.select({ userId: userPermissions.userId })
		.from(userPermissions)
		.where(eq(userPermissions.aprobado, true));

	const ids = new Set(produccion.map((row) => row.userId));
	ids.add(vendedorId);
	return [...ids];
}

function buildMensaje(order: OrderRow, event: EventFields): string {
	switch (event.campoOArea) {
		case 'responsable_actual':
			return `Orden #${order.id} (${order.cliente}): alguien tomó el trabajo en ${order.areaActual}`;
		case 'area_actual':
			return event.valorNuevo === 'listo_para_entrega'
				? `Orden #${order.id} (${order.cliente}): lista para entrega`
				: `Orden #${order.id} (${order.cliente}): pasó a ${event.valorNuevo}`;
		case 'estado':
			return `Orden #${order.id} (${order.cliente}): ${event.valorNuevo}`;
		case 'estado_cobro':
			return `Orden #${order.id} (${order.cliente}): cobro ${event.valorNuevo}`;
		default:
			return `Orden #${order.id} (${order.cliente}) actualizada`;
	}
}

// No lanza — un fallo de notificación (push o insert) nunca debe revertir ni
// bloquear la transición de negocio, que ya se aplicó antes de llamar acá.
export async function notifyOrderChange(order: OrderRow, event: EventFields): Promise<void> {
	const mensaje = buildMensaje(order, event);
	const recipients = await getRecipients(order.vendedorId);

	await Promise.all(
		recipients.map(async (userId) => {
			await db.insert(notifications).values({ userId, orderId: order.id, mensaje });
			await sendPushToUser(userId, {
				title: 'Orden actualizada',
				body: mensaje,
				url: `/ordenes/${order.id}`
			});
		})
	);
}
