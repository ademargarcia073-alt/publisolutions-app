import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/push-subscriptions.schema';

type SubscribeBody = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
type UnsubscribeBody = { endpoint?: string };

// Bajo (app) a propósito — el guard de hooks.server.ts ya garantiza sesión +
// aprobado antes de llegar acá, así que event.locals.user existe siempre.
export const POST: RequestHandler = async (event) => {
	const body: SubscribeBody = await event.request.json();
	const endpoint = body.endpoint;
	const p256dh = body.keys?.p256dh;
	const auth = body.keys?.auth;

	if (!endpoint || !p256dh || !auth) {
		return json({ error: 'Suscripción inválida' }, { status: 400 });
	}

	await db
		.insert(pushSubscriptions)
		.values({ userId: event.locals.user!.id, endpoint, p256dh, auth })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: event.locals.user!.id, p256dh, auth }
		});

	return json({ ok: true });
};

// El usuario puede desactivar notificaciones desde el navegador — esto
// limpia la fila para que no quede una suscripción muerta esperando fallar
// en el próximo push (mismo problema que Architecture Issue 2, resuelto acá
// de forma proactiva en vez de reactiva).
export const DELETE: RequestHandler = async (event) => {
	const body: UnsubscribeBody = await event.request.json();
	const endpoint = body.endpoint;
	if (!endpoint) return json({ error: 'Falta endpoint' }, { status: 400 });

	await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
	return json({ ok: true });
};
