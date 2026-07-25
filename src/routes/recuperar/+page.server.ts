import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

// Una sola pantalla (spec 0.2: "Recuperar contraseña — Flujo estándar de
// recuperación") para las dos etapas: pedir el link por email (sin token en
// la URL) y fijar la contraseña nueva (con token en la URL, viene del link
// que llegó por email).
export const load: PageServerLoad = (event) => {
	const token = event.url.searchParams.get('token');
	const error = event.url.searchParams.get('error');
	return { token, invalid: error === 'INVALID_TOKEN' };
};

export const actions: Actions = {
	solicitar: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';

		try {
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: '/recuperar' }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'No se pudo enviar el email' });
			}
			return fail(500, { message: 'Error inesperado' });
		}

		return { sent: true };
	},

	restablecer: async (event) => {
		const formData = await event.request.formData();
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const token = formData.get('token')?.toString() ?? '';

		try {
			await auth.api.resetPassword({
				body: { newPassword, token }
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'No se pudo restablecer la contraseña' });
			}
			return fail(500, { message: 'Error inesperado' });
		}

		return redirect(302, '/login');
	}
};
