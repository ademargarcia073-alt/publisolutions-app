import { pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// Suscripciones Web Push (VAPID) por usuario. Un usuario puede tener más de
// una fila (varios dispositivos/instalaciones de la PWA). `endpoint` es único
// por dispositivo/navegador — es la URL que el navegador asigna a esa
// suscripción específica.
export const pushSubscriptions = pgTable(
	'push_subscriptions',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [index('push_subscriptions_user_id_idx').on(table.userId)]
);
