<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		optionalLabel = false,
		error,
		...rest
	}: {
		label: string;
		optionalLabel?: boolean;
		error?: string;
	} & HTMLInputAttributes = $props();
</script>

<label class="field">
	<span class="label">
		{label}
		{#if optionalLabel}<span class="optional">(opcional)</span>{/if}
	</span>
	<input class="input" class:has-error={!!error} {...rest} />
	{#if error}
		<span class="error-message">{error}</span>
	{/if}
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: 13px;
		font-weight: 600;
		color: oklch(0.35 0.01 90);
	}

	.optional {
		font-weight: 400;
		color: oklch(0.6 0.01 90);
	}

	.input {
		font-family: var(--font-body);
		font-size: 14px;
		border: 1.5px solid var(--color-border-input);
		border-radius: var(--radius-component);
		padding: 12px 14px;
		color: oklch(0.25 0.01 90);
		background: white;
		width: 100%;
	}

	.input:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 2px;
		border-color: var(--color-accent);
	}

	.input.has-error {
		border-color: var(--color-error);
	}

	.error-message {
		font-size: 12px;
		color: var(--color-error);
	}
</style>
