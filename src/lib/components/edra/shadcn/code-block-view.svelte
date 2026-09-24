<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { CODE_LANGUAGES } from '$lib/content/code-languages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { NodeViewContent, NodeViewWrapper } from '../tiptap';
	import type { CodeBlockViewProps } from './node-views.interfaces';

	const COPIED_FEEDBACK_MS = 1500;

	let { editor, node, updateAttributes }: CodeBlockViewProps = $props();

	let open = $state(false);
	let copied = $state(false);

	const language = $derived(languageOf(node.attrs.language));
	const languageLabel = $derived(language ?? m.editor_code_auto());
	const languageClass = $derived(classFor(language));

	function classFor(value: string | null): string {
		if (value === null) {
			return '';
		}

		return `language-${value}`;
	}

	function languageOf(value: unknown): string | null {
		if (typeof value === 'string' && value !== '') {
			return value;
		}

		return null;
	}

	function choose(value: string | null): void {
		updateAttributes({ language: value });
		open = false;
	}

	async function copy(): Promise<void> {
		await navigator.clipboard.writeText(node.textContent);
		copied = true;
		setTimeout(() => {
			copied = false;
		}, COPIED_FEEDBACK_MS);
	}
</script>

<NodeViewWrapper class="edra-code-block my-4 overflow-hidden rounded-lg border bg-muted/40">
	<div class="flex items-center justify-end gap-1 border-b px-2 py-1" contenteditable="false">
		<Popover.Root bind:open>
			<Popover.Trigger
				disabled={!editor.isEditable}
				aria-label={m.editor_code_language()}
				class={cn(
					buttonVariants({ variant: 'ghost', size: 'xs' }),
					'text-muted-foreground'
				)}
			>
				{languageLabel}
			</Popover.Trigger>
			<Popover.Content class="w-56 gap-0 p-0" portalProps={{ disabled: true }}>
				<Command.Root>
					<Command.Input placeholder={m.editor_code_search_language()} />
					<Command.List class="max-h-64">
						<Command.Empty>{m.editor_code_no_language()}</Command.Empty>
						<Command.Group>
							<Command.Item
								value={m.editor_code_auto()}
								onSelect={() => choose(null)}
							>
								<Check class={cn(language !== null && 'invisible')} />
								{m.editor_code_auto()}
							</Command.Item>
							{#each CODE_LANGUAGES as option (option)}
								<Command.Item value={option} onSelect={() => choose(option)}>
									<Check class={cn(language !== option && 'invisible')} />
									{option}
								</Command.Item>
							{/each}
						</Command.Group>
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
		<Button variant="ghost" size="icon-xs" aria-label={m.editor_code_copy()} onclick={copy}>
			{#if copied}
				<Check />
			{:else}
				<Copy />
			{/if}
		</Button>
	</div>
	<pre class="m-0 overflow-x-auto p-4" spellcheck="false"><NodeViewContent
			as="code"
			class={languageClass}
		/></pre>
</NodeViewWrapper>
