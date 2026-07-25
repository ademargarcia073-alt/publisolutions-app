<script lang="ts">
	import type { Snippet } from 'svelte';
	import TabBar from '$lib/components/TabBar.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="app-content">
	{@render children()}
</div>
<TabBar />

<style>
	.app-content {
		padding-bottom: 64px;
	}
</style>
