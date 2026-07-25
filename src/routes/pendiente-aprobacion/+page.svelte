<script lang="ts">
	import { enhance } from '$app/forms';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
</script>

<div class="screen">
	<Card>
		<h1>Registro pendiente de aprobación</h1>
		<p class="explanation">
			Tu cuenta fue creada correctamente, pero todavía necesita que un administrador la
			apruebe antes de que puedas ingresar. Te avisaremos cuando esté lista.
		</p>
		<form method="post" action="?/signOut" use:enhance>
			<Button type="submit" variant="secondary">Cerrar sesión</Button>
		</form>
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
</style>
