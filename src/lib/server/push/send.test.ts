import { describe, expect, it, vi, beforeEach } from 'vitest';

const sendNotificationMock = vi.fn();
const setVapidDetailsMock = vi.fn();
const selectWhereMock = vi.fn();
const deleteWhereMock = vi.fn();

vi.mock('web-push', () => ({
	default: {
		setVapidDetails: setVapidDetailsMock,
		sendNotification: sendNotificationMock
	}
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		VAPID_PUBLIC_KEY: 'pub-key',
		VAPID_PRIVATE_KEY: 'priv-key',
		VAPID_SUBJECT: 'mailto:test@example.com'
	}
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: selectWhereMock }) }),
		delete: () => ({ where: deleteWhereMock })
	}
}));

const { sendPushToUser } = await import('./send');

const SUB_A = { id: 1, userId: 'u-1', endpoint: 'https://push.example/a', p256dh: 'p1', auth: 'a1' };
const SUB_B = { id: 2, userId: 'u-1', endpoint: 'https://push.example/b', p256dh: 'p2', auth: 'a2' };

beforeEach(() => {
	sendNotificationMock.mockReset();
	selectWhereMock.mockReset();
	deleteWhereMock.mockReset();
});

describe('sendPushToUser — limpieza de suscripciones muertas (Architecture Issue 2)', () => {
	it('envía a todas las suscripciones del usuario', async () => {
		selectWhereMock.mockResolvedValueOnce([SUB_A, SUB_B]);
		sendNotificationMock.mockResolvedValue(undefined);

		await sendPushToUser('u-1', { title: 't', body: 'b' });

		expect(sendNotificationMock).toHaveBeenCalledTimes(2);
		expect(deleteWhereMock).not.toHaveBeenCalled();
	});

	it('borra la suscripción si el envío falla con 404', async () => {
		selectWhereMock.mockResolvedValueOnce([SUB_A]);
		sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 404 }));

		await sendPushToUser('u-1', { title: 't', body: 'b' });

		expect(deleteWhereMock).toHaveBeenCalledOnce();
	});

	it('borra la suscripción si el envío falla con 410', async () => {
		selectWhereMock.mockResolvedValueOnce([SUB_A]);
		sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }));

		await sendPushToUser('u-1', { title: 't', body: 'b' });

		expect(deleteWhereMock).toHaveBeenCalledOnce();
	});

	it('NO borra la suscripción ante otros errores (p. ej. 500 transitorio)', async () => {
		selectWhereMock.mockResolvedValueOnce([SUB_A]);
		sendNotificationMock.mockRejectedValueOnce(Object.assign(new Error('boom'), { statusCode: 500 }));

		await expect(sendPushToUser('u-1', { title: 't', body: 'b' })).resolves.toBeUndefined();
		expect(deleteWhereMock).not.toHaveBeenCalled();
	});

	it('nunca lanza — un fallo de push es best-effort', async () => {
		selectWhereMock.mockResolvedValueOnce([SUB_A]);
		sendNotificationMock.mockRejectedValueOnce(new Error('lo que sea'));

		await expect(sendPushToUser('u-1', { title: 't', body: 'b' })).resolves.toBeUndefined();
	});
});
