import { pgTable, serial, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';
import { orders } from './orders.schema';

// Feed cronológico por-usuario para 1.1 (bell icon desde 1.0) — distinto de
// order_events, que es el historial por-orden que se ve en 2.0. El mismo
// evento de negocio genera una fila acá POR CADA destinatario (broadcast a
// producción + vendedor dueño, spec sección 5) y dispara un push — "mismo
// evento dispara ambos canales".
export const notifications = pgTable(
	'notifications',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		mensaje: text('mensaje').notNull(),
		leida: boolean('leida').default(false).notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('notifications_user_id_idx').on(table.userId)]
);
