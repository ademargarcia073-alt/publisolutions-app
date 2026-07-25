<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';

	let { data }: { data: PageData } = $props();
</script>

<div class="screen">
	<Card wide>
		<h1>Aprobar registros</h1>
		{#if data.pendientes.length === 0}
			<p class="empty">No hay registros pendientes de aprobación.</p>
		{:else}
			<ul class="lista">
				{#each data.pendientes as pendiente (pendiente.userId)}
					<li class="fila">
						<div class="info">
							<span class="nombre">{pendiente.name}</span>
							<span class="email">{pendiente.email}</span>
						</div>
						<form method="post" action="?/aprobar" use:enhance class="form">
							<input type="hidden" name="userId" value={pendiente.userId} />
							<label class="checkbox">
								<input type="checkbox" name="esVendedor" />
								Vendedor
							</label>
							<label class="checkbox">
								<input type="checkbox" name="esAdmin" />
								Admin
							</label>
							<Button type="submit">Aprobar</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</div>

<style>
	.screen {
		min-height: 100vh;
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
	}

	.lista {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.fila {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		border: 1.5px solid var(--color-border-card);
		border-radius: var(--radius-component);
		padding: 12px 14px;
	}

	.info {
		display: flex;
		flex-direction: column;
	}

	.nombre {
		font-weight: 600;
		color: var(--color-text);
	}

	.email {
		font-size: 13px;
		color: var(--color-text-meta);
	}

	.form {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--color-text-secondary);
	}
</style>
