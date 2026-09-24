<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { CategoryFieldValue } from '$lib/components/category-fields.interfaces';
	import CategoryFields from '$lib/components/category-fields.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { categoryErrorMessage } from '$lib/i18n/category-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return categoryErrorMessage(form.error, form.languageCode);
	});

	function displayName(translations: CategoryFieldValue[]): string {
		const preferred = translations.find(
			(translation) => translation.languageCode === data.defaultLanguage
		);

		return preferred?.name ?? translations[0]?.name ?? '';
	}
</script>

<svelte:head>
	<title>{m.categories_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.categories_title()}</h1>
		<p class="text-muted-foreground">{m.categories_description()}</p>
	</div>
	{#if form && 'created' in form}
		<Alert.Root>
			<Alert.Description>{m.categories_created()}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			{#if data.categories.length === 0}
				<p class="text-sm text-muted-foreground">{m.categories_empty()}</p>
			{:else}
				<ul class="grid gap-3" data-testid="category-list">
					{#each data.categories as category (category.id)}
						<li
							class="flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4"
						>
							<div class="grid gap-1">
								<a
									href={resolve(`/panel/categories/${category.id}`)}
									class="font-medium underline-offset-4 hover:underline"
								>
									{displayName(category.translations)}
								</a>
								<p
									class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground"
								>
									{#each category.translations as translation (translation.languageCode)}
										<span>
											<code class="font-mono">{translation.languageCode}</code
											>
											/{translation.slug}
										</span>
									{/each}
								</p>
							</div>
							<span class="text-sm text-muted-foreground">
								{m.categories_post_count({ count: String(category.postCount) })}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Title>
				<h2 class="text-lg font-semibold">{m.categories_create_title()}</h2>
			</Card.Title>
			<Card.Description>{m.categories_create_description()}</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4">
			{#if errorMessage}
				<Alert.Root variant="destructive">
					<Alert.Description>{errorMessage}</Alert.Description>
				</Alert.Root>
			{/if}
			<form method="POST" action="?/create" class="grid gap-4" use:enhance>
				<CategoryFields
					languages={data.languages}
					defaultLanguage={data.defaultLanguage}
					values={[]}
					idPrefix="new"
				/>
				<div>
					<Button type="submit">{m.categories_create_submit()}</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</section>
