<script lang="ts">
	import { page } from '$app/state';
	import type { Permisos } from '$lib/server/permissions';

	let { permisos }: { permisos: Permisos } = $props();

	// Spec sección 1 (1.0): "Nav inferior: Inicio · Nueva orden · Todas las órdenes"
	// "Nueva orden" se oculta para quien no puede crear órdenes (sección 2:
	// un admin que no es también vendedor no puede) — mismo chequeo que
	// puedeCrearOrden() en $lib/server/orders/permissions.ts, inlineado acá
	// porque ese módulo es server-only y no puede importarse en un componente.
	// Sin esto, tocar el tab redirige en silencio de vuelta al dashboard
	// (mismo punto de partida) y da la impresión de que el tab no hace nada.
	const allTabs = [
		{ href: '/', label: 'Inicio', match: (p: string) => p === '/', visible: () => true },
		{
			href: '/ordenes/nueva',
			label: 'Nueva orden',
			match: (p: string) => p === '/ordenes/nueva',
			visible: () => permisos.esVendedor
		},
		{
			href: '/ordenes',
			label: 'Todas las órdenes',
			match: (p: string) => p === '/ordenes' || (p.startsWith('/ordenes/') && p !== '/ordenes/nueva'),
			visible: () => true
		}
	];
	const tabs = $derived(allTabs.filter((tab) => tab.visible()));
</script>

<nav class="tab-bar">
	{#each tabs as tab (tab.href)}
		<a class="tab" class:active={tab.match(page.url.pathname)} href={tab.href}>
			{tab.label}
		</a>
	{/each}
</nav>

<style>
	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border-card);
		padding: 10px 0 max(10px, env(safe-area-inset-bottom));
		z-index: 10;
	}

	.tab {
		flex: 1;
		text-align: center;
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 12px;
		color: var(--color-text-secondary);
		text-decoration: none;
		padding: 6px 4px;
	}

	.tab.active {
		color: var(--color-accent);
	}
</style>
