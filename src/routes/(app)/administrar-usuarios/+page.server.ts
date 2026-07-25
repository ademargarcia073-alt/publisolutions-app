import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/auth.schema';
import { userPermissions } from '$lib/server/db/permissions.schema';
import { requireAdmin } from '$lib/server/permissions';

// Administrar usuarios (T13) — equivalente a 1.2 (Aprobar registros) pero
// para usuarios ya aprobados: /aprobar-registros solo lista aprobado=false,
// así que una vez aprobado no había ninguna pantalla para tocar sus flags
// (spec sección 2 no cubría este caso explícitamente).
export const load: PageServerLoad = async (event) => {
	if (!(await requireAdmin(event))) {
		return redirect(302, '/');
	}

	const usuarios = await db
		.select({
			userId: user.id,
			name: user.name,
			email: user.email,
			esVendedor: userPermissions.esVendedor,
			esAdmin: userPermissions.esAdmin
		})
		.from(userPermissions)
		.innerJoin(user, eq(userPermissions.userId, user.id))
		.where(eq(userPermissions.aprobado, true));

	return { usuarios };
};

export const actions: Actions = {
	actualizar: async (event) => {
		if (!(await requireAdmin(event))) return fail(403, { message: 'No autorizado' });

		const formData = await event.request.formData();
		const userId = formData.get('userId')?.toString() ?? '';
		if (!userId) return fail(400, { message: 'Falta el usuario a actualizar' });

		const esVendedor = formData.get('esVendedor') === 'on';
		const esAdmin = formData.get('esAdmin') === 'on';

		// Un admin no puede quitarse su propio flag de admin — sin esto, un
		// error de un click podría dejar al deploy sin ningún admin (no hay
		// otro camino de vuelta salvo admin:bootstrap, fuera del runtime).
		if (userId === event.locals.user!.id && !esAdmin) {
			return fail(400, { message: 'No podés quitarte tu propio permiso de admin' });
		}

		await db.update(userPermissions).set({ esVendedor, esAdmin }).where(eq(userPermissions.userId, userId));

		return { actualizado: true };
	}
};
