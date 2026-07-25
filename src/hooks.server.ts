import { redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { building } from '$app/environment';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { db } from '$lib/server/db';
import { userPermissions } from '$lib/server/db/permissions.schema';

// Guard global (Architecture Issue 1 — docs/plan-tareas-orden-trabajo.md):
// toda ruta dentro del grupo (app) requiere sesión válida Y aprobado=true.
// Centralizado acá (no repetido por load) porque este hook envuelve TANTO
// load como cada form action — a diferencia de un guard solo-en-load, que
// una action puede saltarse por completo (SvelteKit invoca actions
// directamente, no corre load antes).
//
// Los chequeos de ROL específico (esVendedor/esAdmin para una acción puntual,
// p. ej. "solo admin puede aprobar registros") siguen viviendo en cada route
// (src/lib/server/permissions.ts — requireAdmin/requireVendedor), igual que
// requireStaff() en lavanderia-app-generica: este guard es binario (aprobado
// sí/no) y aplica a todos por igual; el rol específico varía por ruta.
export async function enforceAprobadoGuard(event: RequestEvent) {
	const isAppRoute = event.route.id?.startsWith('/(app)') ?? false;
	if (!isAppRoute) return;

	if (!event.locals.user) {
		redirect(302, '/login');
	}

	const [permisos] = await db
		.select({
			esVendedor: userPermissions.esVendedor,
			esAdmin: userPermissions.esAdmin,
			aprobado: userPermissions.aprobado
		})
		.from(userPermissions)
		.where(eq(userPermissions.userId, event.locals.user.id));

	if (!permisos?.aprobado) {
		redirect(302, '/pendiente-aprobacion');
	}

	// Guardado para que getPermisos()/requireAdmin()/requireVendedor() no
	// repitan esta misma query dentro de cada load/action.
	event.locals.permisos = permisos;
}

export const handle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({
		event,
		auth,
		building,
		resolve: async (event) => {
			await enforceAprobadoGuard(event);
			return resolve(event);
		}
	});
};
