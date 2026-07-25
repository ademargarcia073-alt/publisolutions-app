import { alias } from 'drizzle-orm/pg-core';
import { and, eq, notInArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { orders } from '$lib/server/db/orders.schema';
import { user } from '$lib/server/db/auth.schema';
import { userPermissions } from '$lib/server/db/permissions.schema';

// Dashboard (1.0). Tablero + lista de producción libre en dos queries fijas
// (no una por fila) — Performance Issue 5.
export const load: PageServerLoad = async () => {
	const vendedorUser = alias(user, 'vendedor_user');
	const responsableUser = alias(user, 'responsable_user');

	const tablero = await db
		.select({
			id: orders.id,
			cliente: orders.cliente,
			areaActual: orders.areaActual,
			estado: orders.estado,
			responsableActualId: orders.responsableActual,
			vendedorNombre: vendedorUser.name,
			responsableNombre: responsableUser.name
		})
		.from(orders)
		.leftJoin(vendedorUser, eq(orders.vendedorId, vendedorUser.id))
		.leftJoin(responsableUser, eq(orders.responsableActual, responsableUser.id))
		.where(notInArray(orders.estado, ['entregado', 'cancelada']))
		.orderBy(orders.fechaEntregaComprometida);

	const produccion = await db
		.select({ userId: userPermissions.userId, nombre: user.name })
		.from(userPermissions)
		.innerJoin(user, eq(userPermissions.userId, user.id))
		.where(
			and(
				eq(userPermissions.aprobado, true),
				eq(userPermissions.esVendedor, false),
				eq(userPermissions.esAdmin, false)
			)
		);

	const ocupados = new Set(tablero.map((o) => o.responsableActualId).filter((id) => id !== null));
	const produccionLibre = produccion.filter((p) => !ocupados.has(p.userId));

	return { tablero, produccionLibre, produccionTotal: produccion.length };
};
