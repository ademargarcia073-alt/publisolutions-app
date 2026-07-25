<!-- Dashboard (1.0) — spec sección 1 -->
<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import ActivarNotificaciones from '$lib/components/ActivarNotificaciones.svelte';

	let { data }: { data: PageData } = $props();
</script>

<div class="screen">
	<div class="header">
		<h1>Hola, {data.user.name.split(' ')[0]}</h1>
		<div class="header-actions">
			{#if data.permisos.esAdmin}
				<a class="icon-link" href="/aprobar-registros" aria-label="Aprobar registros">👤</a>
			{/if}
			<a class="icon-link" href="/notificaciones" aria-label="Notificaciones">🔔</a>
		</div>
	</div>

	<ActivarNotificaciones vapidPublicKey={data.vapidPublicKey} />

	<Card wide>
		<h2>Tablero de órdenes</h2>
		{#if data.tablero.length === 0}
			<p class="empty">No hay órdenes activas.</p>
		{:else}
			<ul class="lista">
				{#each data.tablero as orden (orden.id)}
					<li class="fila">
						<a class="orden-link" href="/ordenes/{orden.id}">
							<span class="cliente">#{orden.id} — {orden.cliente}</span>
							<span class="meta">
								{orden.estado}
								{#if orden.areaActual}· {orden.areaActual}{/if}
								{#if orden.responsableNombre}· {orden.responsableNombre}{:else if orden.areaActual}· sin tomar{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>

	<Card wide>
		<h2>Producción libre</h2>
		{#if data.produccionTotal === 0}
			<p class="empty">No hay personal de producción registrado.</p>
		{:else if data.produccionLibre.length === 0}
			<p class="empty">Todos están con una orden asignada.</p>
		{:else}
			<ul class="lista-libre">
				{#each data.produccionLibre as persona (persona.userId)}
					<li>{persona.nombre}</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<style>
	.screen {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px 16px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h1 {
		font-weight: 800;
		font-size: 22px;
		color: var(--color-text);
		margin: 0;
	}

	h2 {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}

	.icon-link {
		font-size: 20px;
		text-decoration: none;
	}

	.empty {
		font-size: 14px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.lista,
	.lista-libre {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.fila {
		border: 1.5px solid var(--color-border-card);
		border-radius: var(--radius-component);
	}

	.orden-link {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		text-decoration: none;
	}

	.cliente {
		font-weight: 600;
		color: var(--color-text);
		font-size: 14px;
	}

	.meta {
		font-size: 12px;
		color: var(--color-text-meta);
	}

	.lista-libre li {
		font-size: 14px;
		color: var(--color-text);
		padding: 6px 0;
		border-bottom: 1px solid var(--color-border-card);
	}

	.lista-libre li:last-child {
		border-bottom: none;
	}
</style>
