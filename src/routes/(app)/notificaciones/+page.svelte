<!-- Notificaciones (1.1) — listado cronológico, spec sección 1 -->
<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';

	let { data }: { data: PageData } = $props();

	function formatFecha(fecha: string | Date): string {
		return new Date(fecha).toLocaleString('es', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="screen">
	<Card wide>
		<h1>Notificaciones</h1>
		{#if data.notificaciones.length === 0}
			<p class="empty">No hay notificaciones todavía.</p>
		{:else}
			<ul class="lista">
				{#each data.notificaciones as n (n.id)}
					<li class="fila">
						<a class="link" href="/ordenes/{n.orderId}">
							<span class="mensaje">{n.mensaje}</span>
							<span class="fecha">{formatFecha(n.createdAt)}</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<style>
	.screen {
		padding: 24px 16px;
	}

	h1 {
		font-weight: 800;
		font-size: 22px;
		color: var(--color-text);
		margin: 0;
	}

	.empty {
		font-size: 14px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fila {
		border-bottom: 1px solid var(--color-border-card);
	}

	.link {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 10px 0;
		text-decoration: none;
	}

	.mensaje {
		font-size: 14px;
		color: var(--color-text);
	}

	.fecha {
		font-size: 12px;
		color: var(--color-text-meta);
		white-space: nowrap;
	}
</style>
