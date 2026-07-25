import type { User, Session } from 'better-auth';
import type { Permisos } from '$lib/server/permissions';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties
		}

		// permisos: poblado por hooks.server.ts SOLO para rutas dentro de
		// (app) (donde el guard ya necesita consultarlo). undefined en rutas
		// públicas — no asumir que existe fuera de (app).
		interface Locals { user?: User; session?: Session; permisos?: Permisos }

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
