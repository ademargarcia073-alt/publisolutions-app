<script lang="ts">
	import { subscribeToPush, isPushSupported } from '$lib/push-client';
	import Button from '$lib/components/Button.svelte';

	let { vapidPublicKey }: { vapidPublicKey: string | null } = $props();

	let estado = $state<'idle' | 'activando' | 'activado' | 'error'>('idle');
	let errorMsg = $state('');

	async function activar() {
		if (!vapidPublicKey) {
			estado = 'error';
			errorMsg = 'Notificaciones no configuradas todavía (falta VAPID_PUBLIC_KEY)';
			return;
		}
		estado = 'activando';
		try {
			await subscribeToPush(vapidPublicKey);
			estado = 'activado';
		} catch (e) {
			estado = 'error';
			errorMsg = e instanceof Error ? e.message : 'Error inesperado';
		}
	}
</script>

{#if isPushSupported() && estado !== 'activado'}
	<div class="activar-notificaciones">
		<Button variant="secondary" onclick={activar} disabled={estado === 'activando'}>
			{estado === 'activando' ? 'Activando…' : 'Activar notificaciones'}
		</Button>
		{#if estado === 'error'}
			<p class="error">{errorMsg}</p>
		{/if}
	</div>
{/if}

<style>
	.activar-notificaciones {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.error {
		font-size: 12px;
		color: var(--color-error);
		margin: 0;
	}
</style>
