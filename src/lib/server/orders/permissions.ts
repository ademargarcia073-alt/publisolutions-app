import type { Permisos } from '$lib/server/permissions';
import type { orders } from '$lib/server/db/orders.schema';

export type OrderRow = typeof orders.$inferSelect;

// "Producción" no es un flag propio — es implícito para TODO usuario
// aprobado, sin importar qué otros flags tenga (spec sección 2: "Producción:
// implícito para todos los usuarios aprobados, sin flag propio" + la fila
// "Tomar/completar" da Sí en la columna Producción para cualquier aprobado).
// Un vendedor o un admin pueden ADEMÁS ser parte de producción al mismo
// tiempo — los flags son aditivos, nunca excluyentes entre sí. Única fuente
// de verdad — reusada tanto por applyOrderEvent() (T4) como por el load de
// 2.0 (T9) para decidir qué botones mostrar, así ambos lugares nunca pueden
// divergir.
export function isProduccion(permisos: Permisos): boolean {
	return permisos.aprobado;
}

export function puedeCrearOrden(permisos: Permisos): boolean {
	// A diferencia de las demás acciones, admin NO tiene bypass acá — el spec
	// dice explícitamente "Sí (si también es vendedor)" para Crear orden
	// (sección 2), no "Sí" a secas como en cancelar/entregar/editar.
	return permisos.esVendedor;
}

export function puedeEditarDatosGenerales(
	order: OrderRow,
	userId: string,
	permisos: Permisos
): boolean {
	const esCreador = order.vendedorId === userId && permisos.esVendedor;
	if (!(permisos.esAdmin || esCreador)) return false;
	// "mientras nadie tomó la orden" — nadie tomó nunca ninguna área todavía:
	// sigue en el pool de la primera área de la secuencia.
	return order.areaActual === order.areasSeleccionadas[0] && order.responsableActual === null;
}

export function puedeTomar(order: OrderRow, permisos: Permisos): boolean {
	return (
		isProduccion(permisos) &&
		order.estado === 'en_producción' &&
		order.areaActual !== null &&
		order.responsableActual === null
	);
}

export function puedeCompletar(order: OrderRow, userId: string, permisos: Permisos): boolean {
	return (
		(permisos.esAdmin || order.responsableActual === userId) &&
		order.estado === 'en_producción' &&
		order.areaActual !== null
	);
}

export function puedeDevolver(order: OrderRow, userId: string, permisos: Permisos): boolean {
	if (!(permisos.esAdmin || order.responsableActual === userId)) return false;
	if (order.estado !== 'en_producción' || !order.areaActual) return false;
	return order.areasSeleccionadas.indexOf(order.areaActual) > 0;
}

export function puedeCancelar(order: OrderRow, userId: string, permisos: Permisos): boolean {
	const esCreador = permisos.esVendedor && order.vendedorId === userId;
	return (
		(permisos.esAdmin || esCreador) && (order.estado === 'creada' || order.estado === 'en_producción')
	);
}

export function puedeEntregar(order: OrderRow, userId: string, permisos: Permisos): boolean {
	const esCreador = permisos.esVendedor && order.vendedorId === userId;
	return (permisos.esAdmin || esCreador) && order.estado === 'listo_para_entrega';
}

export function puedeCobrar(order: OrderRow, permisos: Permisos): boolean {
	return permisos.esAdmin && order.estado === 'entregado' && order.estadoCobro !== 'cobrado';
}
