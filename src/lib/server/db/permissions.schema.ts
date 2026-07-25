import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// App-level permission flags, kept separate from Better-Auth's own `user`
// table so `bun run auth:schema` never has a reason to touch it — Better-Auth
// owns auth-only fields, we own this (same split as contact-info in the
// lavanderia-app-generica reference project).
//
// Permisos aditivos, no roles excluyentes (spec sección 2): un usuario puede
// tener esVendedor Y esAdmin en true a la vez. "Producción" no es un flag
// propio — es la condición derivada aprobado=true AND esVendedor=false AND
// esAdmin=false (ver docs/design-orden-trabajo.md).
export const userPermissions = pgTable('user_permissions', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	esVendedor: boolean('es_vendedor').default(false).notNull(),
	esAdmin: boolean('es_admin').default(false).notNull(),
	// Todo usuario nuevo empieza sin aprobar (spec 0.1) — el primer admin de
	// cada deploy se aprueba a mano en Neon, mismo posture manual que el resto
	// del bootstrap (no hay UI de "primer admin").
	aprobado: boolean('aprobado').default(false).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});
