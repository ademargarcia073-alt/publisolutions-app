import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { orders, AREAS, TIPOS_TRABAJO, UNIDADES_DIMENSION } from '$lib/server/db/orders.schema';
import { orderEvents } from '$lib/server/db/order-events.schema';
import { orderFormSchema } from '$lib/schemas/order';
import { puedeCrearOrden } from '$lib/server/orders/permissions';
import { notifyOrderChange } from '$lib/server/push/notify';

// Crear orden (2.0) — spec sección 2: a diferencia de casi todo lo demás,
// un admin que NO es también vendedor no puede crear (puedeCrearOrden no
// tiene bypass de admin, ver permissions.ts).
export const load: PageServerLoad = (event) => {
	if (!puedeCrearOrden(event.locals.permisos!)) {
		return redirect(302, '/');
	}
	return { areas: AREAS, tiposTrabajo: TIPOS_TRABAJO, unidades: UNIDADES_DIMENSION };
};

export const actions: Actions = {
	default: async (event) => {
		if (!puedeCrearOrden(event.locals.permisos!)) {
			return fail(403, { message: 'No autorizado para crear órdenes' });
		}

		const formData = await event.request.formData();
		const areasSeleccionadas = formData.getAll('areasSeleccionadas');

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
			areasSeleccionadas,
			total: formData.get('total'),
			aCuenta: formData.get('aCuenta')
		});

		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
		}

		const data = parsed.data;
		const [nuevaOrden] = await db
			.insert(orders)
			.values({
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
				vendedorId: event.locals.user!.id,
				areasSeleccionadas: data.areasSeleccionadas,
				total: String(data.total),
				aCuenta: String(data.aCuenta),
				areaActual: data.areasSeleccionadas[0],
				estado: 'en_producción'
			})
			.returning();

		await db.insert(orderEvents).values({
			orderId: nuevaOrden.id,
			usuarioId: event.locals.user!.id,
			campoOArea: 'estado',
			valorAnterior: null,
			valorNuevo: 'en_producción'
		});

		await notifyOrderChange(nuevaOrden, {
			campoOArea: 'estado',
			valorAnterior: null,
			valorNuevo: 'en_producción'
		});

		return redirect(302, `/ordenes/${nuevaOrden.id}`);
	}
};
