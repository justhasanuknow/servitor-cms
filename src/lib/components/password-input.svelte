<script lang="ts">
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import { onMount } from 'svelte';
	import * as InputGroup from '$lib/components/ui/input-group';
	import { m } from '$lib/paraglide/messages';
	import type { PasswordInputProps } from './password-input.interfaces';

	let {
		value = $bindable(),
		toggleLabel = m.common_show_password(),
		...restProps
	}: PasswordInputProps = $props();

	let input = $state<HTMLInputElement | null>(null);
	let hydrated = $state(false);
	let visible = $state(false);

	const type = $derived(typeFor(visible));

	function typeFor(shown: boolean): 'text' | 'password' {
		if (shown) {
			return 'text';
		}

		return 'password';
	}

	function hide(): void {
		visible = false;

		if (input !== null) {
			input.type = 'password';
		}
	}

	onMount(() => {
		hydrated = true;
	});

	$effect(() => {
		const form = input?.form;

		if (!form) {
			return;
		}

		form.addEventListener('submit', hide, { capture: true });

		return () => {
			form.removeEventListener('submit', hide, { capture: true });
		};
	});
</script>

<InputGroup.Root>
	<InputGroup.Input
		bind:ref={input}
		bind:value
		{type}
		autocapitalize="off"
		autocorrect="off"
		spellcheck={false}
		{...restProps}
	/>
	{#if hydrated}
		<InputGroup.Addon align="inline-end">
			<InputGroup.Button
				size="icon-xs"
				aria-pressed={visible}
				aria-controls={restProps.id}
				onclick={() => {
					visible = !visible;
				}}
			>
				{#if visible}
					<EyeOff aria-hidden="true" />
				{:else}
					<Eye aria-hidden="true" />
				{/if}
				<span class="sr-only">{toggleLabel}</span>
			</InputGroup.Button>
		</InputGroup.Addon>
	{/if}
</InputGroup.Root>
