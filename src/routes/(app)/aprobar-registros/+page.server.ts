import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { userPermissions } from '$lib/server/db/permissions.schema';
import { requireAdmin } from '$lib/server/permissions';

// El guard de hooks.server.ts ya garantiza sesión+aprobado por estar dentro
// de (app) — pero NO chequea es_admin (eso es específico de esta ruta, no
// binario para todos). Spec sección 2: "Aprobar registros (1.2) — No / No / Sí".
export const load: PageServerLoad = async (event) => {
	if (!(await requireAdmin(event))) {
		return redirect(302, '/');
	}

	const pendientes = await db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			createdAt: user.createdAt
		})
		.from(userPermissions)
		.innerJoin(user, eq(userPermissions.userId, user.id))
		.where(eq(userPermissions.aprobado, false));

	return { pendientes };
};

export const actions: Actions = {
	aprobar: async (event) => {
		if (!(await requireAdmin(event))) return fail(403, { message: 'No autorizado' });

		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		if (!userId) return fail(400, { message: 'Falta el usuario a aprobar' });

		const esVendedor = formData.get('esVendedor') === 'on';
		const esAdmin = formData.get('esAdmin') === 'on';

		await db
			.update(userPermissions)
			.set({ aprobado: true, esVendedor, esAdmin })
			.where(eq(userPermissions.userId, userId));

		return { aprobado: true };
	}
};
