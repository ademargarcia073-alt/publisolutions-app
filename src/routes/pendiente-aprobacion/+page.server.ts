import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getPermisos } from '$lib/server/permissions';
import { auth } from '$lib/server/auth';

// Fuera del grupo (app) a propósito — si estuviera adentro, el guard de
// hooks.server.ts redirigiría un usuario no-aprobado A ESTA MISMA pantalla en
// bucle infinito. Por eso repite acá el chequeo mínimo que necesita.
export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}

	const permisos = await getPermisos(event);
	if (permisos?.aprobado) {
		return redirect(302, '/');
	}

	return {};
};

export const actions: Actions = {
	signOut: async (event) => {
		await auth.api.signOut({ headers: event.request.headers });
		return redirect(302, '/login');
	}
};
