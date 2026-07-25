#!/usr/bin/env bun
// permisos:set — herramienta de CLI para tocar es_vendedor/es_admin de un
// usuario YA aprobado, sin escribir SQL a mano. Mismo trust model que
// admin-bootstrap.ts: vive fuera del runtime de la app, se corre a mano con
// el DATABASE_URL de quien lo ejecuta.
//
// A diferencia de admin-bootstrap.ts (que promueve al primer admin y puede
// crear su fila de permisos), este script exige que el usuario YA tenga una
// fila en user_permissions — es decir, ya se registró y fue aprobado por
// /aprobar-registros o por admin:bootstrap. No aprueba a nadie ni crea filas
// nuevas.
//
// Uso:
//   bun run permisos:set <email> --vendedor
//   bun run permisos:set <email> --no-vendedor
//   bun run permisos:set <email> --admin --vendedor
//
// Solo se actualizan los flags pasados como argumento — el resto queda igual.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { user } from '../src/lib/server/db/auth.schema';
import { userPermissions } from '../src/lib/server/db/permissions.schema';

const [email, ...flagArgs] = process.argv.slice(2);

function usageError(message: string): never {
	console.error(message);
	console.error(
		'Uso: bun run permisos:set <email> [--vendedor|--no-vendedor] [--admin|--no-admin]'
	);
	process.exit(1);
}

if (!email) usageError('Falta el email.');
if (flagArgs.length === 0) usageError('Falta al menos una flag para actualizar.');

const updates: { esVendedor?: boolean; esAdmin?: boolean } = {};
for (const flag of flagArgs) {
	switch (flag) {
		case '--vendedor':
			updates.esVendedor = true;
			break;
		case '--no-vendedor':
			updates.esVendedor = false;
			break;
		case '--admin':
			updates.esAdmin = true;
			break;
		case '--no-admin':
			updates.esAdmin = false;
			break;
		default:
			usageError(`Flag desconocida: "${flag}".`);
	}
}

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL no está seteada (revisa tu .env).');
	process.exit(1);
}

const client = neon(process.env.DATABASE_URL);
const db = drizzle(client);

const [foundUser] = await db.select().from(user).where(eq(user.email, email));

if (!foundUser) {
	console.error(`No existe ningún usuario con email "${email}".`);
	process.exit(1);
}

const [existing] = await db
	.select()
	.from(userPermissions)
	.where(eq(userPermissions.userId, foundUser.id));

if (!existing) {
	console.error(
		`"${email}" todavía no tiene permisos asignados — debe aprobarse primero (por /aprobar-registros o bun run admin:bootstrap).`
	);
	process.exit(1);
}

await db.update(userPermissions).set(updates).where(eq(userPermissions.userId, foundUser.id));

const [updated] = await db
	.select()
	.from(userPermissions)
	.where(eq(userPermissions.userId, foundUser.id));

console.log(
	`✓ ${foundUser.name} <${foundUser.email}> — esVendedor=${updated.esVendedor}, esAdmin=${updated.esAdmin}, aprobado=${updated.aprobado}`
);
