<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { EdraCommand } from '../commands.interfaces';
	import type { SlashCommandListViewProps } from '../extensions/slash-command.interfaces';

	let { items, command }: SlashCommandListViewProps = $props();

	let selected = $state(0);
	let container: HTMLDivElement | undefined = $state();

	const flat = $derived(items.flatMap((group) => group.commands));
	const current = $derived(Math.min(selected, Math.max(flat.length - 1, 0)));

	$effect(() => {
		container?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' });
	});

	export function handleKeyDown(event: KeyboardEvent): boolean {
		if (event.key === 'ArrowDown') {
			move(1);

			return true;
		}

		if (event.key === 'ArrowUp') {
			move(-1);

			return true;
		}

		if (event.key === 'Enter') {
			const target = flat[current];

			if (target === undefined) {
				return false;
			}

			command(target);

			return true;
		}

		return false;
	}

	function move(step: number): void {
		if (flat.length === 0) {
			return;
		}

		selected = (current + step + flat.length) % flat.length;
	}

	function indexOf(item: EdraCommand): number {
		return flat.indexOf(item);
	}
</script>

<div
	bind:this={container}
	role="listbox"
	aria-label={m.editor_slash_label()}
	class="max-h-72 w-60 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-md"
>
	{#if flat.length === 0}
		<p class="px-2 py-1.5 text-sm text-muted-foreground">{m.editor_slash_empty()}</p>
	{/if}
	{#each items as group (group.id)}
		<div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group.label}</div>
		{#each group.commands as item (item.id)}
			<button
				type="button"
				role="option"
				aria-selected={indexOf(item) === current}
				data-index={indexOf(item)}
				class={cn(
					'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-hidden',
					indexOf(item) === current && 'bg-accent text-accent-foreground'
				)}
				onpointerenter={() => (selected = indexOf(item))}
				onclick={() => command(item)}
			>
				<item.icon class="size-4 text-muted-foreground" />
				<span>{item.label}</span>
			</button>
		{/each}
	{/each}
</div>
