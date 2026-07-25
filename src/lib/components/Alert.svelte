<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="alert">
	{@render children()}
</div>

<style>
	.alert {
		border: 1.5px solid var(--color-error);
		background: var(--color-error-bg);
		border-radius: var(--radius-component);
		padding: 12px 14px;
		font-size: 13px;
		color: oklch(0.5 0.15 25);
	}
</style>
