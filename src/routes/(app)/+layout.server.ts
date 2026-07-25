import type { LayoutServerLoad } from './$types';

// La sesión + aprobado ya está garantizada acá — hooks.server.ts redirige
// antes de llegar a este load si no se cumple. Este layout solo expone los
// datos ya validados a las páginas hijas (mismo patrón que
// lavanderia-app-generica: el guard vive en un solo lugar, el layout solo
// pasa los datos).
export const load: LayoutServerLoad = (event) => {
	return {
		user: event.locals.user!,
		permisos: event.locals.permisos!
	};
};
