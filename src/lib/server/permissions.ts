import type { RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { userPermissions } from '$lib/server/db/permissions.schema';

export type Permisos = {
	esVendedor: boolean;
	esAdmin: boolean;
	aprobado: boolean;
};

// Lee los flags de permiso del usuario. Reutiliza event.locals.permisos si el
// hook ya los cargó (rutas dentro de (app) — ver hooks.server.ts) para no
// repetir la query; si no está (rutas públicas, o un caso no cubierto por el
// hook), hace la query acá.
export async function getPermisos(event: RequestEvent): Promise<Permisos | null> {
	if (!event.locals.user) return null;
	if (event.locals.permisos) return event.locals.permisos;

	const [row] = await db
		.select({
			esVendedor: userPermissions.esVendedor,
			esAdmin: userPermissions.esAdmin,
			aprobado: userPermissions.aprobado
		})
		.from(userPermissions)
		.where(eq(userPermissions.userId, event.locals.user.id));

	return row ?? null;
}

// Cualquier acción de ruta (form action) debe repetir su propio chequeo de
// rol — SvelteKit invoca una action directamente, no corre el guard de
// hooks.server.ts ni ningún load antes (mismo motivo que requireStaff() en
// lavanderia-app-generica). Estas funciones son ese chequeo por-action.
export async function requireAdmin(event: RequestEvent): Promise<boolean> {
	const permisos = await getPermisos(event);
	return permisos?.aprobado === true && permisos.esAdmin === true;
}

export async function requireVendedor(event: RequestEvent): Promise<boolean> {
	const permisos = await getPermisos(event);
	return permisos?.aprobado === true && permisos.esVendedor === true;
}

// "Producción" no es un flag propio — todo usuario aprobado que no es
// vendedor ni admin es, por definición, producción (docs/design-orden-trabajo.md).
// En la práctica casi toda acción de producción también la puede hacer un
// admin, así que los call sites de T4 chequean OR contra esAdmin donde el
// spec lo permite — esta función es solo para el caso "cualquier aprobado".
export async function requireAprobado(event: RequestEvent): Promise<boolean> {
	const permisos = await getPermisos(event);
	return permisos?.aprobado === true;
}
