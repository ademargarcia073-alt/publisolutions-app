import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/notifications.schema';

// Listado cronológico de notificaciones dentro de la app (spec 1.1).
export const load: PageServerLoad = async (event) => {
	const lista = await db
		.select()
		.from(notifications)
		.where(eq(notifications.userId, event.locals.user!.id))
		.orderBy(desc(notifications.createdAt));

	return { notificaciones: lista };
};
