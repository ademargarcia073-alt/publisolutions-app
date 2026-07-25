import { error, fail } from '@sveltejs/kit';
import { eq, asc } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { orders, AREAS, TIPOS_TRABAJO, UNIDADES_DIMENSION } from '$lib/server/db/orders.schema';
import { orderEvents } from '$lib/server/db/order-events.schema';
import { user } from '$lib/server/db/auth.schema';
import { orderFormSchema, devolverSchema } from '$lib/schemas/order';
import {
	puedeEditarDatosGenerales,
	puedeTomar,
	puedeCompletar,
	puedeDevolver,
	puedeCancelar,
	puedeEntregar,
	puedeCobrar
} from '$lib/server/orders/permissions';
import { tomar, completar, devolver, cancelar, entregar, cobrar } from '$lib/server/orders/apply-order-event';

async function loadOrder(orderId: number) {
	const [orden] = await db.select().from(orders).where(eq(orders.id, orderId));
	return orden ?? null;
}

// Formulario/detalle de orden (2.0) — ver/editar + historial cuando se abre
// desde 3.0 (spec sección 1).
export const load: PageServerLoad = async (event) => {
	const orderId = Number(event.params.id);
	if (!Number.isInteger(orderId)) error(404, 'Orden no encontrada');

	const orden = await loadOrder(orderId);
	if (!orden) error(404, 'Orden no encontrada');

	const historial = await db
		.select({
			id: orderEvents.id,
			campoOArea: orderEvents.campoOArea,
			valorAnterior: orderEvents.valorAnterior,
			valorNuevo: orderEvents.valorNuevo,
			nota: orderEvents.nota,
			timestamp: orderEvents.timestamp,
			usuarioNombre: user.name
		})
		.from(orderEvents)
		.innerJoin(user, eq(orderEvents.usuarioId, user.id))
		.where(eq(orderEvents.orderId, orderId))
		.orderBy(asc(orderEvents.timestamp));

	const userId = event.locals.user!.id;
	const permisos = event.locals.permisos!;

	return {
		orden,
		historial,
		areas: AREAS,
		tiposTrabajo: TIPOS_TRABAJO,
		unidades: UNIDADES_DIMENSION,
		flags: {
			puedeEditar: puedeEditarDatosGenerales(orden, userId, permisos),
			puedeTomar: puedeTomar(orden, permisos),
			puedeCompletar: puedeCompletar(orden, userId, permisos),
			puedeDevolver: puedeDevolver(orden, userId, permisos),
			puedeCancelar: puedeCancelar(orden, userId, permisos),
			puedeEntregar: puedeEntregar(orden, userId, permisos),
			puedeCobrar: puedeCobrar(orden, permisos)
		}
	};
};

export const actions: Actions = {
	editar: async (event) => {
		const orderId = Number(event.params.id);
		const orden = await loadOrder(orderId);
		if (!orden) return fail(404, { message: 'Orden no encontrada' });

		if (!puedeEditarDatosGenerales(orden, event.locals.user!.id, event.locals.permisos!)) {
			return fail(403, { message: 'Ya no se puede editar esta orden (alguien ya la tomó)' });
		}

		const formData = await event.request.formData();
		const parsed = orderFormSchema.safeParse({
			cliente: formData.get('cliente'),
			tipoTrabajo: formData.get('tipoTrabajo'),
			descripcion: formData.get('descripcion'),
			cantidad: formData.get('cantidad'),
			dimension: {
				alto: formData.get('alto'),
				ancho: formData.get('ancho'),
				unidad: formData.get('unidad')
			},
			material: formData.get('material'),
			acabado: formData.get('acabado'),
			arte: formData.get('arte') || undefined,
			fechaEntregaComprometida: formData.get('fechaEntregaComprometida'),
			areasSeleccionadas: formData.getAll('areasSeleccionadas'),
			total: formData.get('total'),
			aCuenta: formData.get('aCuenta')
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
		}

		const data = parsed.data;
		await db
			.update(orders)
			.set({
				cliente: data.cliente,
				tipoTrabajo: data.tipoTrabajo,
				descripcion: data.descripcion,
				cantidad: data.cantidad,
				alto: String(data.dimension.alto),
				ancho: String(data.dimension.ancho),
				unidad: data.dimension.unidad,
				material: data.material,
				acabado: data.acabado,
				arte: data.arte,
				fechaEntregaComprometida: data.fechaEntregaComprometida,
				areasSeleccionadas: data.areasSeleccionadas,
				total: String(data.total),
				aCuenta: String(data.aCuenta),
				// La secuencia pudo cambiar — recalcular el área actual contra la
				// nueva lista (todavía nadie tomó nada, por el guard de arriba).
				areaActual: data.areasSeleccionadas[0]
			})
			.where(eq(orders.id, orderId));

		return { editado: true };
	},

	tomar: async (event) => {
		const orderId = Number(event.params.id);
		const result = await tomar(orderId, event.locals.user!.id, event.locals.permisos!);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	},

	completar: async (event) => {
		const orderId = Number(event.params.id);
		const result = await completar(orderId, event.locals.user!.id, event.locals.permisos!);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	},

	devolver: async (event) => {
		const orderId = Number(event.params.id);
		const formData = await event.request.formData();
		const parsed = devolverSchema.safeParse({ nota: formData.get('nota') });
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Falta la nota' });
		}
		const result = await devolver(
			orderId,
			event.locals.user!.id,
			event.locals.permisos!,
			parsed.data.nota
		);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	},

	cancelar: async (event) => {
		const orderId = Number(event.params.id);
		const result = await cancelar(orderId, event.locals.user!.id, event.locals.permisos!);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	},

	entregar: async (event) => {
		const orderId = Number(event.params.id);
		const result = await entregar(orderId, event.locals.user!.id, event.locals.permisos!);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	},

	cobrar: async (event) => {
		const orderId = Number(event.params.id);
		const result = await cobrar(orderId, event.locals.user!.id, event.locals.permisos!);
		return result.ok ? { ok: true } : fail(400, { message: result.error });
	}
};
