import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { pushSubscriptions } from '$lib/server/db/push-subscriptions.schema';

export type PushPayload = { title: string; body: string; url?: string };

function getVapidKeys(): VapidKeys {
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
		throw new Error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT no están configuradas');
	}
	return {
		subject: env.VAPID_SUBJECT,
		publicKey: env.VAPID_PUBLIC_KEY,
		privateKey: env.VAPID_PRIVATE_KEY
	};
}

type Subscription = typeof pushSubscriptions.$inferSelect;

// Best-effort: nunca tira — un push fallido no debe tumbar la transición de
// negocio que ya se aplicó (docs/design-orden-trabajo.md — precisión sobre
// atomicidad). Limpia la suscripción en el mismo intento fallido si el
// servicio de push confirma que ya no es válida (Architecture Issue 2).
async function sendToSubscription(
	sub: Subscription,
	payload: PushPayload,
	vapid: VapidKeys
): Promise<void> {
	const subscription: PushSubscription = {
		endpoint: sub.endpoint,
		expirationTime: null,
		keys: { p256dh: sub.p256dh, auth: sub.auth }
	};

	try {
		const request = await buildPushPayload(
			{ data: payload, options: { ttl: 60 } },
			subscription,
			vapid
		);
		const response = await fetch(sub.endpoint, request as RequestInit);

		if (response.status === 404 || response.status === 410) {
			await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
			return;
		}

		if (!response.ok) {
			console.error(
				`push falló para la suscripción ${sub.id} (usuario ${sub.userId}): status ${response.status}`
			);
		}
	} catch (error) {
		console.error(`push falló para la suscripción ${sub.id} (usuario ${sub.userId}):`, error);
	}
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
	const vapid = getVapidKeys();
	const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
	await Promise.all(subs.map((sub) => sendToSubscription(sub, payload, vapid)));
}
