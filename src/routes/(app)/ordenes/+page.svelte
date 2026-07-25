<!-- Listado de órdenes (3.0) — spec sección 1 -->
<script lang="ts">
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';

	let { data }: { data: PageData } = $props();

	function formatFecha(fecha: string | Date): string {
		return new Date(fecha).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' });
	}
</script>

<div class="screen">
	<Card wide>
		<h1>Todas las órdenes</h1>

		<!-- Filtros simples (spec: la query los soporta, la UI se simplifica en v1) -->
		<form method="get" class="filtros">
			<select name="estado">
				<option value="">Todos los estados</option>
				{#each data.estados as estado (estado)}
					<option value={estado} selected={estado === data.filtros.estado}>{estado}</option>
				{/each}
			</select>
			<select name="area">
				<option value="">Todas las áreas</option>
				{#each data.areas as area (area)}
					<option value={area} selected={area === data.filtros.area}>{area}</option>
				{/each}
			</select>
			<input type="text" name="cliente" placeholder="Cliente" value={data.filtros.cliente ?? ''} />
			<Button type="submit" variant="secondary">Filtrar</Button>
			{#if data.filtros.estado || data.filtros.area || data.filtros.cliente}
				<Button href="/ordenes" variant="secondary">Limpiar</Button>
			{/if}
		</form>

		{#if data.lista.length === 0}
			<p class="empty">No hay órdenes que coincidan.</p>
		{:else}
			<ul class="lista">
				{#each data.lista as orden (orden.id)}
					<li>
						<a class="fila" href="/ordenes/{orden.id}">
							<span class="cliente">#{orden.id} — {orden.cliente}</span>
							<span class="meta">
								{orden.estado}{#if orden.areaActual}· {orden.areaActual}{/if}
								· {orden.vendedorNombre} · {formatFecha(orden.fechaCreacion)}
							</span>
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
		margin: 0 0 12px;
	}

	.filtros {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 16px;
	}

	.filtros select,
	.filtros input {
		font-family: var(--font-body);
		font-size: 13px;
		border: 1.5px solid var(--color-border-input);
		border-radius: var(--radius-component);
		padding: 8px 10px;
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
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1.5px solid var(--color-border-card);
		border-radius: var(--radius-component);
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
		text-transform: capitalize;
	}
</style>
