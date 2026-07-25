<script lang="ts">
	import { page } from '$app/state';

	// Spec sección 1 (1.0): "Nav inferior: Inicio · Nueva orden · Todas las órdenes"
	const tabs = [
		{ href: '/', label: 'Inicio', match: (p: string) => p === '/' },
		{ href: '/ordenes/nueva', label: 'Nueva orden', match: (p: string) => p === '/ordenes/nueva' },
		{
			href: '/ordenes',
			label: 'Todas las órdenes',
			match: (p: string) => p === '/ordenes' || (p.startsWith('/ordenes/') && p !== '/ordenes/nueva')
		}
	];
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
