<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { cn } from '$lib/utils';
	import type { ToolbarButtonProps } from './toolbar-button.interfaces';

	let {
		label,
		shortcut = '',
		active = false,
		disabled = false,
		onclick,
		children
	}: ToolbarButtonProps = $props();

	function keepSelection(event: MouseEvent): void {
		event.preventDefault();
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon-sm"
				aria-label={label}
				aria-pressed={active}
				{disabled}
				class={cn(active && 'bg-muted text-primary')}
				onmousedown={keepSelection}
				{onclick}
			>
				{@render children()}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>
		<span>{label}</span>
		{#if shortcut !== ''}
			<kbd data-slot="kbd" class="bg-background/20 px-1 font-sans">{shortcut}</kbd>
		{/if}
	</Tooltip.Content>
</Tooltip.Root>
