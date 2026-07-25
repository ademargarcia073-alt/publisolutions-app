#!/usr/bin/env bun
// Bootstrap del primer admin (decisión post-T3 — docs/plan-tareas-orden-trabajo.md).
//
// Problema que resuelve: 1.2 (Aprobar registros) solo es accesible para un
// usuario ya aprobado con es_admin=true — pero el primer usuario que se
// registra no tiene a nadie que lo apruebe. Este script es el único punto de
// escalamiento de privilegios que existe en todo el proyecto, y vive FUERA
// del runtime de la app (no hay ninguna ruta HTTP que lo dispare).
//
// Uso (una sola vez por deploy, después de que la persona se registre
// normalmente por /registro):
//   bun run admin:bootstrap admin@cliente.com
//
// No crea usuarios ni toca contraseñas — reusa el signup normal de
// Better-Auth. Solo falla fuerte si el email no existe todavía, en vez de
// actualizar 0 filas en silencio (el problema del SQL a mano).
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { user } from '../src/lib/server/db/auth.schema';
import { userPermissions } from '../src/lib/server/db/permissions.schema';

const email = process.argv[2];
if (!email) {
	console.error('Uso: bun run admin:bootstrap <email>');
	process.exit(1);
}

if (!process.env.DATABASE_URL) {
	console.error('DATABASE_URL no está seteada (revisa tu .env).');
	process.exit(1);
}

const client = neon(process.env.DATABASE_URL);
const db = drizzle(client);

const [foundUser] = await db.select().from(user).where(eq(user.email, email));

if (!foundUser) {
	console.error(
		`No existe ningún usuario con email "${email}". Debe registrarse primero por /registro — este script solo PROMUEVE una cuenta existente, no crea una nueva.`
	);
	process.exit(1);
}

await db
	.insert(userPermissions)
	.values({ userId: foundUser.id, esVendedor: false, esAdmin: true, aprobado: true })
	.onConflictDoUpdate({
		target: userPermissions.userId,
		set: { esAdmin: true, aprobado: true }
	});

console.log(`✓ ${foundUser.name} <${foundUser.email}> ahora es admin aprobado.`);
