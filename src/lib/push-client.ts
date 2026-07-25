// Helper de cliente para activar Web Push. La UI que lo dispara (botón,
// prompt, etc.) la arma T7/T8 — esto es solo el mecanismo reusable.

export function isPushSupported(): boolean {
	return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = atob(base64);
	return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function subscribeToPush(vapidPublicKey: string): Promise<void> {
	if (!isPushSupported()) {
		throw new Error('Este navegador no soporta notificaciones push');
	}

	const registration = await navigator.serviceWorker.register('/sw.js');
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource
	});

	const response = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subscription.toJSON())
	});

	if (!response.ok) {
		throw new Error('No se pudo registrar la suscripción en el servidor');
	}
}

export async function unsubscribeFromPush(): Promise<void> {
	if (!isPushSupported()) return;

	const registration = await navigator.serviceWorker.getRegistration('/sw.js');
	const subscription = await registration?.pushManager.getSubscription();
	if (!subscription) return;

	await fetch('/api/push/subscribe', {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ endpoint: subscription.endpoint })
	});

	await subscription.unsubscribe();
}
