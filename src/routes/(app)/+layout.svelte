<script lang="ts">
	import type { Snippet } from 'svelte';

	// T7 agrega acá el nav inferior (Inicio · Nueva orden · Todas las órdenes).
	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
