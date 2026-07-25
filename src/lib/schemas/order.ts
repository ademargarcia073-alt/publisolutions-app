import { z } from 'zod';
import { AREAS, TIPOS_TRABAJO, UNIDADES_DIMENSION } from '$lib/server/db/orders.schema';

// Medianoche de hoy, hora local del server — evita rechazar "hoy mismo" por
// culpa de la hora del día (spec no dice explícitamente "hoy vale", pero
// rechazar el mismo día sería más estricto de lo razonable).
function startOfToday(): Date {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const dimensionSchema = z.object({
	alto: z.coerce.number().positive('El alto debe ser mayor a 0'),
	ancho: z.coerce.number().positive('El ancho debe ser mayor a 0'),
	unidad: z.enum(UNIDADES_DIMENSION)
});

// areasSeleccionadas debe ser un subconjunto de AREAS que respeta el ORDEN
// FIJO de fábrica (spec sección 3: "el sistema respeta siempre ese orden
// para las marcadas") — no alcanza con que cada elemento sea un área válida,
// también tienen que aparecer en el mismo orden relativo que AREAS.
const areasSeleccionadasSchema = z
	.array(z.enum(AREAS))
	.min(1, 'Hay que seleccionar al menos un área de producción')
	.refine((areas) => new Set(areas).size === areas.length, 'No se puede repetir un área')
	.refine((areas) => {
		const indices = areas.map((a) => AREAS.indexOf(a));
		return indices.every((idx, i) => i === 0 || idx > indices[i - 1]);
	}, 'Las áreas deben respetar el orden fijo: Diseño → Impresión → Corte → Metalmecánica → Armado');

// Formulario 2.0 — crear/editar orden (spec sección 3, "Datos generales" +
// "Áreas de producción" + "Financiero"). No incluye los campos automáticos/
// derivados (fecha_creacion, vendedor_id, area_actual, estado, etc.) — esos
// los pone el server, no el formulario.
export const orderFormSchema = z
	.object({
		cliente: z.string().trim().min(1, 'El cliente es obligatorio'),
		tipoTrabajo: z.enum(TIPOS_TRABAJO),
		descripcion: z.string().trim().min(1, 'La descripción es obligatoria'),
		cantidad: z.coerce.number().int().positive('La cantidad debe ser mayor a 0'),
		dimension: dimensionSchema,
		material: z.string().trim().min(1, 'El material es obligatorio'),
		acabado: z.string().trim().min(1, 'El acabado es obligatorio'),
		// Opcional (spec sección 3: "arte — texto libre, opcional").
		arte: z.string().trim().optional(),
		fechaEntregaComprometida: z.coerce
			.date()
			.refine((d) => d >= startOfToday(), 'La fecha de entrega no puede ser en el pasado'),
		areasSeleccionadas: areasSeleccionadasSchema,
		total: z.coerce.number().nonnegative('El total no puede ser negativo'),
		aCuenta: z.coerce.number().nonnegative('El monto a cuenta no puede ser negativo')
	})
	.refine((data) => data.aCuenta <= data.total, {
		message: 'El monto a cuenta no puede ser mayor al total',
		path: ['aCuenta']
	});

export type OrderFormInput = z.infer<typeof orderFormSchema>;

// Devolver a área anterior — nota obligatoria (decisión post-revisión, ver
// design doc). No es parte de orderFormSchema porque no es un campo de la
// orden, es un dato de la transición en sí (order_events.nota).
export const devolverSchema = z.object({
	nota: z.string().trim().min(1, 'La nota es obligatoria para devolver a área anterior')
});

export type DevolverInput = z.infer<typeof devolverSchema>;
