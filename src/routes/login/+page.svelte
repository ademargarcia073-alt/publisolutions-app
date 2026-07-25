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
		<h1>Iniciar sesión</h1>
		<form method="post" action="?/signInEmail" use:enhance class="form">
			<TextField
				label="Correo electrónico"
				type="email"
				name="email"
				placeholder="correo@ejemplo.com"
				required
			/>
			<div class="password-field">
				<TextField label="Contraseña" type="password" name="password" placeholder="Tu contraseña" required />
				<a class="forgot-link" href="/recuperar">¿Olvidaste tu contraseña?</a>
			</div>
			{#if form?.message}
				<p class="form-error">{form.message}</p>
			{/if}
			<Button type="submit">Entrar</Button>
		</form>
		<p class="footer-link">¿No tienes cuenta? <a href="/registro">Regístrate</a></p>
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

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.password-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.forgot-link {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-accent);
		text-align: right;
		text-decoration: none;
	}

	.forgot-link:hover {
		color: var(--color-accent-hover);
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
