import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, '/');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: { email, password }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'No se pudo iniciar sesión' });
			}
			return fail(500, { message: 'Error inesperado' });
		}

		// El guard de hooks.server.ts decide a dónde va desde acá — aprobado
		// entra al dashboard (1.0), no aprobado va a /pendiente-aprobacion.
		return redirect(302, '/');
	}
};
