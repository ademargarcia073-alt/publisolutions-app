<!-- Formulario/detalle de orden (2.0) — crear, spec sección 3 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import TextField from '$lib/components/TextField.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="screen">
	<Card wide>
		<h1>Nueva orden</h1>
		<form method="post" use:enhance class="form">
			<TextField label="Cliente" name="cliente" required />

			<label class="select-field">
				<span class="label">Tipo de trabajo</span>
				<select name="tipoTrabajo" required>
					{#each data.tiposTrabajo as tipo (tipo)}
						<option value={tipo}>{tipo}</option>
					{/each}
				</select>
			</label>

			<TextField label="Descripción" name="descripcion" required />
			<TextField label="Cantidad" name="cantidad" type="number" min="1" required />

			<div class="dimension-row">
				<TextField label="Alto" name="alto" type="number" min="0.01" step="0.01" required />
				<TextField label="Ancho" name="ancho" type="number" min="0.01" step="0.01" required />
				<label class="select-field">
					<span class="label">Unidad</span>
					<select name="unidad" required>
						{#each data.unidades as unidad (unidad)}
							<option value={unidad}>{unidad}</option>
						{/each}
					</select>
				</label>
			</div>

			<TextField label="Material" name="material" required />
			<TextField label="Acabado" name="acabado" required />
			<TextField label="Arte" name="arte" optionalLabel />
			<TextField
				label="Fecha de entrega comprometida"
				name="fechaEntregaComprometida"
				type="date"
				required
			/>

			<fieldset class="areas-fieldset">
				<legend>Áreas de producción</legend>
				{#each data.areas as area (area)}
					<label class="checkbox">
						<input type="checkbox" name="areasSeleccionadas" value={area} />
						{area}
					</label>
				{/each}
			</fieldset>

			<TextField label="Total" name="total" type="number" min="0" step="0.01" required />
			<TextField label="A cuenta" name="aCuenta" type="number" min="0" step="0.01" required />

			{#if form?.message}
				<p class="form-error">{form.message}</p>
			{/if}

			<Button type="submit">Crear orden</Button>
		</form>
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

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.dimension-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 12px;
	}

	.select-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: 13px;
		font-weight: 600;
		color: oklch(0.35 0.01 90);
	}

	select {
		font-family: var(--font-body);
		font-size: 14px;
		border: 1.5px solid var(--color-border-input);
		border-radius: var(--radius-component);
		padding: 12px 14px;
		background: white;
		width: 100%;
	}

	.areas-fieldset {
		border: 1.5px solid var(--color-border-card);
		border-radius: var(--radius-component);
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.areas-fieldset legend {
		font-size: 13px;
		font-weight: 600;
		color: oklch(0.35 0.01 90);
		padding: 0 4px;
	}

	.checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: var(--color-text);
		text-transform: capitalize;
	}

	.form-error {
		font-size: 13px;
		color: var(--color-error);
		margin: 0;
	}
</style>
