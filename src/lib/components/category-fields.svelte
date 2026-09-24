<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { m } from '$lib/paraglide/messages';
	import type { CategoryFieldsProps } from './category-fields.interfaces';

	let { languages, defaultLanguage, values, idPrefix }: CategoryFieldsProps = $props();

	function valueFor(code: string) {
		return values.find((value) => value.languageCode === code);
	}
</script>

<div class="grid gap-4">
	{#each languages as language (language.code)}
		{@const current = valueFor(language.code)}
		<fieldset class="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
			<legend class="px-1 text-sm font-medium">
				{language.name}
				<span class="text-muted-foreground">({language.code})</span>
				{#if language.code === defaultLanguage}
					<span class="text-muted-foreground">· {m.languages_status_default()}</span>
				{:else if !language.enabled}
					<span class="text-muted-foreground">· {m.languages_status_disabled()}</span>
				{/if}
			</legend>
			<div class="grid gap-2">
				<Label for="{idPrefix}-name-{language.code}">{m.categories_field_name()}</Label>
				<Input
					id="{idPrefix}-name-{language.code}"
					name="name:{language.code}"
					maxlength={100}
					required={language.code === defaultLanguage}
					value={current?.name ?? ''}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="{idPrefix}-slug-{language.code}">{m.categories_field_slug()}</Label>
				<Input
					id="{idPrefix}-slug-{language.code}"
					name="slug:{language.code}"
					maxlength={120}
					value={current?.slug ?? ''}
				/>
			</div>
		</fieldset>
	{/each}
	<p class="text-sm text-muted-foreground">{m.categories_slug_hint()}</p>
</div>
