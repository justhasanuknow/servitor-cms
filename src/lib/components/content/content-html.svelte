<script lang="ts">
	import 'katex/dist/katex.min.css';
	import { cn } from '$lib/utils';
	import type { ContentHtmlProps } from './content-html.interfaces';

	let { sanitizedHtml, lang, class: className }: ContentHtmlProps = $props();
</script>

<div class={cn('servitor-content', className)} {lang}>
	{@html sanitizedHtml}
</div>
