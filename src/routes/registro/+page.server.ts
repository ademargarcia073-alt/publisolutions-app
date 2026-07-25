import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { db } from '$lib/server/db';
import { userPermissions } from '$lib/server/db/permissions.schema';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		if (!name) {
			return fail(400, { message: 'El nombre es obligatorio' });
		}

		let userId: string;
		try {
			const result = await auth.api.signUpEmail({
				body: { email, password, name }
			});
			userId = result.user.id;
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'No se pudo completar el registro' });
			}
			return fail(500, { message: 'Error inesperado' });
		}

		// Todo usuario nuevo empieza sin aprobar (spec 0.1) — "producción" no es
		// un flag propio, así que un registro nuevo no elige rol acá: el admin
		// asigna es_vendedor/es_admin manualmente si corresponde al aprobar
		// (1.2). Por defecto, alguien aprobado sin flags es producción.
		await db.insert(userPermissions).values({ userId });

		// signUpEmail ya deja sesión iniciada — el guard de hooks.server.ts
		// manda a /pendiente-aprobacion porque aprobado=false todavía.
		return redirect(302, '/');
	}
};
