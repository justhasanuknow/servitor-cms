<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import CategoryFields from '$lib/components/category-fields.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { categoryErrorMessage } from '$lib/i18n/category-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const title = $derived(
		data.category.translations.find((entry) => entry.languageCode === data.defaultLanguage)
			?.name ??
			data.category.translations[0]?.name ??
			''
	);

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return categoryErrorMessage(form.error, form.languageCode);
	});
</script>

<svelte:head>
	<title>{title} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-2">
		<a
			href={resolve('/panel/categories')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.categories_back()}
		</a>
		<h1 class="text-2xl font-semibold">{title}</h1>
		<p class="text-sm text-muted-foreground">
			{m.categories_post_count({ count: String(data.category.postCount) })}
		</p>
	</div>
	{#if form && 'saved' in form}
		<Alert.Root>
			<Alert.Description>{m.categories_saved()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			<form method="POST" action="?/update" class="grid gap-4" use:enhance>
				<CategoryFields
					languages={data.languages}
					defaultLanguage={data.defaultLanguage}
					values={data.category.translations}
					idPrefix="edit"
				/>
				<div>
					<Button type="submit">{m.categories_save()}</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
	{#if data.category.postCount === 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2 class="font-semibold">{m.categories_delete_title()}</h2>
				</Card.Title>
				<Card.Description>{m.categories_delete_description()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/delete" use:enhance>
					<Button type="submit" variant="destructive"
						>{m.categories_delete_submit()}</Button
					>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}
</section>
