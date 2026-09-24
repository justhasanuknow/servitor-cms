<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';
	import TranslationEditor from './translation-editor.svelte';

	let { data, form }: PageProps = $props();

	const editorKey = $derived(`${data.editor.id}:${data.editor.draft.version}`);
	const pageTitle = $derived(data.editor.draft.title || m.posts_untitled());
</script>

<svelte:head>
	<title>{pageTitle} · {m.app_name()}</title>
</svelte:head>
{#key editorKey}
	<TranslationEditor {data} {form} />
{/key}
