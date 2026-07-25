import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { orders } from './orders.schema';

// Historial append-only (spec sección 3) — única fuente de verdad para el
// historial de cambios que se muestra en 2.0 cuando se abre desde 3.0.
// Nunca se actualiza ni se borra una fila existente, solo se inserta.
export const orderEvents = pgTable(
	'order_events',
	{
		id: serial('id').primaryKey(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		usuarioId: text('usuario_id')
			.notNull()
			.references(() => user.id),
		// Nombre del campo o área que cambió (p. ej. "estado", "area_actual",
		// "corte", "total").
		campoOArea: text('campo_o_area').notNull(),
		valorAnterior: text('valor_anterior'),
		valorNuevo: text('valor_nuevo'),
		// Opcional en general; OBLIGATORIA a nivel de aplicación (no de DB,
		// porque solo aplica a un tipo de evento) para el evento de devolución
		// a área anterior — ver docs/design-orden-trabajo.md.
		nota: text('nota'),
		timestamp: timestamp('timestamp').defaultNow().notNull()
	},
	(table) => [index('order_events_order_id_idx').on(table.orderId)]
);
