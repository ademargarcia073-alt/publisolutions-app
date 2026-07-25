import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/push-subscriptions.schema';

export type PushPayload = { title: string; body: string; url?: string };

let configured = false;
function ensureConfigured() {
	if (configured) return;
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
		throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no están configuradas');
	}
	webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
	configured = true;
}

type Subscription = typeof pushSubscriptions.$inferSelect;

// Best-effort: nunca tira — un push fallido no debe tumbar la transición de
// negocio que ya se aplicó (docs/design-orden-trabajo.md — precisión sobre
// atomicidad). Limpia la suscripción en el mismo intento fallido si el
// servicio de push confirma que ya no es válida (Architecture Issue 2).
async function sendToSubscription(sub: Subscription, payload: PushPayload): Promise<void> {
	try {
		await webpush.sendNotification(
			{ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
			JSON.stringify(payload)
		);
	} catch (error) {
		const statusCode = (error as { statusCode?: number }).statusCode;
		if (statusCode === 404 || statusCode === 410) {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
			return;
		}
		console.error(`push falló para la suscripción ${sub.id} (usuario ${sub.userId}):`, error);
	}
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
	ensureConfigured();
	const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
	await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)));
}
