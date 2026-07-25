import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ilike } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { orders, AREAS, ORDER_ESTADOS } from '$lib/server/db/orders.schema';
import { user } from '$lib/server/db/auth.schema';

// Listado de órdenes (3.0) — spec sección 1: "Todas las órdenes, cronológico,
// visible para todos los roles sin filtrar [por defecto]. Debería contemplar
// filtros (estado / área / cliente) desde el MVP". La query soporta los 3
// filtros vía query params; la UI (T10) los expone simple (selects + texto),
// no un panel de filtros avanzado — eso queda explícitamente fuera de scope
// (spec sección 6).
export const load: PageServerLoad = async (event) => {
	const estado = event.url.searchParams.get('estado') || undefined;
	const area = event.url.searchParams.get('area') || undefined;
	const cliente = event.url.searchParams.get('cliente') || undefined;

	const vendedorUser = alias(user, 'vendedor_user');

	const condiciones = [
		estado ? eq(orders.estado, estado as (typeof ORDER_ESTADOS)[number]) : undefined,
		area ? eq(orders.areaActual, area as (typeof AREAS)[number]) : undefined,
		cliente ? ilike(orders.cliente, `%${cliente}%`) : undefined
	].filter((c) => c !== undefined);

	const lista = await db
		.select({
			id: orders.id,
			cliente: orders.cliente,
			estado: orders.estado,
			areaActual: orders.areaActual,
			fechaCreacion: orders.fechaCreacion,
			vendedorNombre: vendedorUser.name
		})
		.from(orders)
		.leftJoin(vendedorUser, eq(orders.vendedorId, vendedorUser.id))
		.where(condiciones.length > 0 ? and(...condiciones) : undefined)
		.orderBy(desc(orders.fechaCreacion));

	return {
		lista,
		filtros: { estado, area, cliente },
		estados: ORDER_ESTADOS,
		areas: AREAS
	};
};
