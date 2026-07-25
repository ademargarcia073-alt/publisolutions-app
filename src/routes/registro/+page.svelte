<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import TextField from '$lib/components/TextField.svelte';

	let { form }: { form: ActionData } = $props();
</script>

<div class="screen">
	<Card>
		<h1>Crear cuenta</h1>
		<p class="explanation">
			Tu cuenta necesita aprobación de un administrador antes de poder ingresar.
		</p>
		<form method="post" use:enhance class="form">
			<TextField label="Nombre completo" name="name" placeholder="Ej. María Fernández" required />
			<TextField
				label="Correo electrónico"
				type="email"
				name="email"
				placeholder="correo@ejemplo.com"
				required
			/>
			<TextField
				label="Contraseña"
				type="password"
				name="password"
				placeholder="Mínimo 8 caracteres"
				required
				minlength={8}
			/>
			{#if form?.message}
				<p class="form-error">{form.message}</p>
			{/if}
			<Button type="submit">Registrarme</Button>
		</form>
		<p class="footer-link">¿Ya tienes cuenta? <a href="/login">Iniciar sesión</a></p>
	</Card>
</div>

<style>
	.screen {
		min-height: 100vh;
		display: flex;
		align-items: center;
		padding: 24px 16px;
	}

	h1 {
		font-weight: 800;
		font-size: 22px;
		color: var(--color-text);
		margin: 0;
	}

	.explanation {
		font-size: 14px;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.form-error {
		font-size: 13px;
		color: var(--color-error);
		margin: 0;
	}

	.footer-link {
		font-size: 13px;
		color: var(--color-text-meta);
		text-align: center;
		margin: 0;
	}

	.footer-link a {
		color: var(--color-accent);
		font-weight: 600;
		text-decoration: none;
	}

	.footer-link a:hover {
		color: var(--color-accent-hover);
	}
</style>
