<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes, HTMLAnchorAttributes } from 'svelte/elements';

	let {
		variant = 'primary',
		href,
		children,
		...rest
	}: {
		variant?: 'primary' | 'secondary';
		href?: string;
		children: Snippet;
	} & HTMLButtonAttributes &
		HTMLAnchorAttributes = $props();
</script>

{#if href}
	<a class="btn {variant}" {href} {...rest}>
		{@render children()}
	</a>
{:else}
	<button class="btn {variant}" {...rest}>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 15px;
		border: none;
		border-radius: var(--radius-component);
		padding: 14px 24px;
		text-align: center;
		cursor: pointer;
		display: inline-block;
		text-decoration: none;
	}

	.btn:disabled {
		background: var(--color-btn-disabled-bg);
		color: var(--color-btn-disabled-text);
		cursor: default;
	}

	.btn.primary {
		background: var(--color-accent);
		color: white;
	}

	.btn.primary:hover:not(:disabled) {
		background: var(--color-accent-hover);
	}

	.btn.secondary {
		background: var(--color-btn-secondary-bg);
		color: var(--color-btn-secondary-text);
	}

	.btn:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
	}
</style>
