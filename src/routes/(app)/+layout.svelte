<script lang="ts">
	import type { Snippet } from 'svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import type { LayoutData } from './$types';

	let { children, data }: { children: Snippet; data: LayoutData } = $props();
</script>

<div class="app-content">
	{@render children()}
</div>
<TabBar permisos={data.permisos} />

<style>
	.app-content {
		padding-bottom: 64px;
	}
</style>
