<!-- Formulario/detalle de orden (2.0) — ver/editar + historial, spec sección 1 -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import TextField from '$lib/components/TextField.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function fechaInput(fecha: string | Date): string {
		return new Date(fecha).toISOString().slice(0, 10);
	}

	function formatFecha(fecha: string | Date): string {
		return new Date(fecha).toLocaleString('es', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="screen">
	<Card wide>
		<h1>Orden #{data.orden.id} — {data.orden.cliente}</h1>
		<p class="meta">
			{data.orden.estado}
			{#if data.orden.areaActual}· área actual: {data.orden.areaActual}{/if}
			· cobro: {data.orden.estadoCobro} · saldo: {data.orden.saldo}
		</p>

		{#if form?.message}
			<p class="form-error">{form.message}</p>
		{/if}

		{#if data.flags.puedeEditar}
			<form method="post" action="?/editar" use:enhance class="form">
				<TextField label="Cliente" name="cliente" value={data.orden.cliente} required />
				<label class="select-field">
					<span class="label">Tipo de trabajo</span>
					<select name="tipoTrabajo" required>
						{#each data.tiposTrabajo as tipo (tipo)}
							<option value={tipo} selected={tipo === data.orden.tipoTrabajo}>{tipo}</option>
						{/each}
					</select>
				</label>
				<TextField label="Descripción" name="descripcion" value={data.orden.descripcion} required />
				<TextField label="Cantidad" name="cantidad" type="number" min="1" value={data.orden.cantidad} required />
				<div class="dimension-row">
					<TextField label="Alto" name="alto" type="number" min="0.01" step="0.01" value={data.orden.alto} required />
					<TextField label="Ancho" name="ancho" type="number" min="0.01" step="0.01" value={data.orden.ancho} required />
					<label class="select-field">
						<span class="label">Unidad</span>
						<select name="unidad" required>
							{#each data.unidades as unidad (unidad)}
								<option value={unidad} selected={unidad === data.orden.unidad}>{unidad}</option>
							{/each}
						</select>
					</label>
				</div>
				<TextField label="Material" name="material" value={data.orden.material} required />
				<TextField label="Acabado" name="acabado" value={data.orden.acabado} required />
				<TextField label="Arte" name="arte" value={data.orden.arte ?? ''} optionalLabel />
				<TextField
					label="Fecha de entrega comprometida"
					name="fechaEntregaComprometida"
					type="date"
					value={fechaInput(data.orden.fechaEntregaComprometida)}
					required
				/>
				<fieldset class="areas-fieldset">
					<legend>Áreas de producción</legend>
					{#each data.areas as area (area)}
						<label class="checkbox">
							<input
								type="checkbox"
								name="areasSeleccionadas"
								value={area}
								checked={data.orden.areasSeleccionadas.includes(area)}
							/>
							{area}
						</label>
					{/each}
				</fieldset>
				<TextField label="Total" name="total" type="number" min="0" step="0.01" value={data.orden.total} required />
				<TextField label="A cuenta" name="aCuenta" type="number" min="0" step="0.01" value={data.orden.aCuenta} required />
				<Button type="submit">Guardar cambios</Button>
			</form>
		{:else}
			<dl class="detalle">
				<dt>Tipo de trabajo</dt><dd>{data.orden.tipoTrabajo}</dd>
				<dt>Descripción</dt><dd>{data.orden.descripcion}</dd>
				<dt>Cantidad</dt><dd>{data.orden.cantidad}</dd>
				<dt>Dimensión</dt><dd>{data.orden.alto} × {data.orden.ancho} {data.orden.unidad}</dd>
				<dt>Material</dt><dd>{data.orden.material}</dd>
				<dt>Acabado</dt><dd>{data.orden.acabado}</dd>
				{#if data.orden.arte}<dt>Arte</dt><dd>{data.orden.arte}</dd>{/if}
				<dt>Entrega comprometida</dt><dd>{formatFecha(data.orden.fechaEntregaComprometida)}</dd>
				<dt>Áreas</dt><dd>{data.orden.areasSeleccionadas.join(' → ')}</dd>
				<dt>Total / a cuenta</dt><dd>{data.orden.total} / {data.orden.aCuenta}</dd>
			</dl>
		{/if}
	</Card>

	<Card wide>
		<h2>Acciones</h2>
		<div class="acciones">
			{#if data.flags.puedeTomar}
				<form method="post" action="?/tomar" use:enhance>
					<Button type="submit">Tomar</Button>
				</form>
			{/if}
			{#if data.flags.puedeCompletar}
				<form method="post" action="?/completar" use:enhance>
					<Button type="submit">Completar parte</Button>
				</form>
			{/if}
			{#if data.flags.puedeEntregar}
				<form method="post" action="?/entregar" use:enhance>
					<Button type="submit">Marcar entregado</Button>
				</form>
			{/if}
			{#if data.flags.puedeCobrar}
				<form method="post" action="?/cobrar" use:enhance>
					<Button type="submit">Marcar cobrado</Button>
				</form>
			{/if}
			{#if data.flags.puedeCancelar}
				<form method="post" action="?/cancelar" use:enhance>
					<Button type="submit" variant="secondary">Cancelar orden</Button>
				</form>
			{/if}
		</div>

		{#if data.flags.puedeDevolver}
			<form method="post" action="?/devolver" use:enhance class="devolver-form">
				<TextField label="Motivo (obligatorio)" name="nota" placeholder="Ej. defecto de impresión" required />
				<Button type="submit" variant="secondary">Devolver a área anterior</Button>
			</form>
		{/if}
	</Card>

	<Card wide>
		<h2>Historial</h2>
		{#if data.historial.length === 0}
			<p class="empty">Sin cambios todavía.</p>
		{:else}
			<ul class="historial">
				{#each data.historial as evento (evento.id)}
					<li>
						<span class="evento-linea">
							<strong>{evento.usuarioNombre}</strong> — {evento.campoOArea}: {evento.valorAnterior ?? '—'} → {evento.valorNuevo ?? '—'}
						</span>
						{#if evento.nota}<span class="evento-nota">"{evento.nota}"</span>{/if}
						<span class="evento-fecha">{formatFecha(evento.timestamp)}</span>
					</li>
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

	h1 {
		font-weight: 800;
		font-size: 20px;
		color: var(--color-text);
		margin: 0;
	}

	h2 {
		font-size: 15px;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.meta {
		font-size: 13px;
		color: var(--color-text-meta);
		margin: 0;
	}

	.form-error {
		font-size: 13px;
		color: var(--color-error);
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

	.detalle {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 12px;
		margin: 0;
	}

	.detalle dt {
		font-size: 12px;
		color: var(--color-text-meta);
	}

	.detalle dd {
		font-size: 14px;
		color: var(--color-text);
		margin: 0;
	}

	.acciones {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.devolver-form {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
		border-top: 1px solid var(--color-border-card);
		padding-top: 12px;
	}

	.empty {
		font-size: 14px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.historial {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.historial li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border-bottom: 1px solid var(--color-border-card);
		padding-bottom: 8px;
	}

	.evento-linea {
		font-size: 13px;
		color: var(--color-text);
	}

	.evento-nota {
		font-size: 12px;
		color: var(--color-text-secondary);
		font-style: italic;
	}

	.evento-fecha {
		font-size: 11px;
		color: var(--color-text-meta);
	}
</style>
