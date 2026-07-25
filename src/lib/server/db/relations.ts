import { relations } from 'drizzle-orm';
import { user } from './auth.schema';
import { userPermissions } from './permissions.schema';
import { orders } from './orders.schema';
import { orderEvents } from './order-events.schema';
import { pushSubscriptions } from './push-subscriptions.schema';
import { notifications } from './notifications.schema';

// Todas las relaciones cruzadas viven acá, en un archivo separado de cada
// pgTable — evita ciclos de import entre orders.schema/order-events.schema
// (que se referencian mutuamente vía FK) y mantiene cada archivo de tabla
// enfocado solo en su propia definición de columnas.

export const userRelationsApp = relations(user, ({ one, many }) => ({
	permisos: one(userPermissions, {
		fields: [user.id],
		references: [userPermissions.userId]
	}),
	ordenesComoVendedor: many(orders, { relationName: 'vendedor' }),
	ordenesComoResponsable: many(orders, { relationName: 'responsable' }),
	pushSubscriptions: many(pushSubscriptions),
	notifications: many(notifications)
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
	vendedor: one(user, {
		fields: [orders.vendedorId],
		references: [user.id],
		relationName: 'vendedor'
	}),
	responsable: one(user, {
		fields: [orders.responsableActual],
		references: [user.id],
		relationName: 'responsable'
	}),
	eventos: many(orderEvents),
	notificaciones: many(notifications)
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
	orden: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
	usuario: one(user, { fields: [orderEvents.usuarioId], references: [user.id] })
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
	usuario: one(user, { fields: [pushSubscriptions.userId], references: [user.id] })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	usuario: one(user, { fields: [notifications.userId], references: [user.id] }),
	orden: one(orders, { fields: [notifications.orderId], references: [orders.id] })
}));
