// Service worker — Web Push (spec sección 5). Sin caché de assets a
// propósito: esta app no necesita funcionar offline, solo recibir push con
// la app cerrada. Un SW más ambicioso (precache, offline shell) es scope
// que no pidió el spec.

self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: 'Notificación', body: event.data ? event.data.text() : '' };
	}

	const title = data.title || 'Orden actualizada';
	const options = {
		body: data.body || '',
		data: { url: data.url || '/' }
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data?.url || '/';

	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === url && 'focus' in client) return client.focus();
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		})
	);
});
