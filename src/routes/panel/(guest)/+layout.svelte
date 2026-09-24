<script lang="ts">
	import { page } from '$app/state';
	import ServitorMark from '$lib/components/brand/servitor-mark.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { UI_LOCALE_AUTONYMS, UI_LOCALES } from '$lib/constants/preferences';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const localeOptions = UI_LOCALES.map((locale) => ({
		value: locale,
		label: UI_LOCALE_AUTONYMS[locale]
	}));
</script>

<main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
	<p class="flex items-center gap-2 text-xl font-semibold tracking-tight">
		<ServitorMark class="size-8 shrink-0" />
		{m.app_name()}
	</p>
	{@render children()}
	<form method="POST" action="/preferences/locale" class="flex items-end gap-2">
		<input type="hidden" name="redirectTo" value={`${page.url.pathname}${page.url.search}`} />
		<div class="grid gap-1">
			<Label for="guest-language" class="text-xs text-muted-foreground">
				{m.language_label()}
			</Label>
			<NativeSelect
				id="guest-language"
				name="locale"
				options={localeOptions}
				value={getLocale()}
				class="h-8 w-40"
			/>
		</div>
		<Button type="submit" variant="outline" size="sm">{m.language_submit()}</Button>
	</form>
</main>
