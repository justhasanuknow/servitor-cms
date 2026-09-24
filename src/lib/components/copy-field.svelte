<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { CopyFieldProps } from './copy-field.interfaces';

	let { id, label, value }: CopyFieldProps = $props();

	let copied = $state(false);

	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(value);
		copied = true;
	}
</script>

<div class="grid gap-2">
	<Label for={id}>{label}</Label>
	<div class="flex gap-2">
		<Input {id} {value} readonly class="font-mono text-xs" data-testid="copy-field" />
		<Button type="button" variant="outline" onclick={copy}>
			{#if copied}
				{m.common_copied()}
			{:else}
				{m.common_copy()}
			{/if}
		</Button>
	</div>
</div>
