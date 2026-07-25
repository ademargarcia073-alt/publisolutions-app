import { describe, expect, it, vi, beforeEach } from 'vitest';

const selectWhereMock = vi.fn();
const insertValuesMock = vi.fn();
const sendPushToUserMock = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => ({ from: () => ({ where: selectWhereMock }) }),
		insert: () => ({ values: insertValuesMock })
	}
}));

vi.mock('./send', () => ({
	sendPushToUser: sendPushToUserMock
}));

const { notifyOrderChange } = await import('./notify');

const ORDER = {
	id: 42,
	cliente: 'Ferretería El Tornillo',
	vendedorId: 'vendedor-1',
	areaActual: 'corte'
} as never;

beforeEach(() => {
	selectWhereMock.mockReset();
	insertValuesMock.mockReset();
	sendPushToUserMock.mockClear();
});

describe('notifyOrderChange', () => {
	it('notifica a producción (broadcast) + al vendedor dueño, sin duplicar si el vendedor también es producción', async () => {
		selectWhereMock.mockResolvedValueOnce([{ userId: 'prod-1' }, { userId: 'prod-2' }]);

		await notifyOrderChange(ORDER, {
			campoOArea: 'area_actual',
			valorAnterior: 'impresion',
			valorNuevo: 'corte'
		});

		const notifiedUserIds = insertValuesMock.mock.calls.map((call) => call[0].userId).sort();
		expect(notifiedUserIds).toEqual(['prod-1', 'prod-2', 'vendedor-1']);
		expect(sendPushToUserMock).toHaveBeenCalledTimes(3);
	});

	it('no duplica al vendedor si ya está en la lista de producción', async () => {
		selectWhereMock.mockResolvedValueOnce([{ userId: 'vendedor-1' }]);

		await notifyOrderChange(ORDER, {
			campoOArea: 'estado',
			valorAnterior: 'en_producción',
			valorNuevo: 'listo_para_entrega'
		});

		expect(insertValuesMock).toHaveBeenCalledTimes(1);
	});

	it('arma un mensaje legible por tipo de evento', async () => {
		selectWhereMock.mockResolvedValueOnce([]);

		await notifyOrderChange(ORDER, {
			campoOArea: 'estado_cobro',
			valorAnterior: 'pendiente',
			valorNuevo: 'cobrado'
		});

		expect(insertValuesMock).toHaveBeenCalledWith(
			expect.objectContaining({ mensaje: expect.stringContaining('cobro cobrado') })
		);
	});
});
