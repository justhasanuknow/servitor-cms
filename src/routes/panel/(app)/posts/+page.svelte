<script lang="ts">
	import FilePlus from '@lucide/svelte/icons/file-plus';
	import { resolve } from '$app/paths';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import NativeSelect from '$lib/components/native-select.svelte';
	import Pager from '$lib/components/pager.svelte';
	import TranslationStatusBadge from '$lib/components/posts/translation-status-badge.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { languageLabel, postErrorMessage, postTitle } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const languageOptions = $derived(
		data.languages
			.filter((language) => language.enabled)
			.map((language) => ({
				value: language.code,
				label: `${language.nativeName} (${language.code})`
			}))
	);

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return postErrorMessage(form.error);
	});

	const scopeParams = $derived.by((): Record<string, string> => {
		if (data.showAll) {
			return { scope: 'all' };
		}

		return {};
	});
</script>

<svelte:head>
	<title>{m.posts_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.posts_title()}</h1>
		<p class="text-muted-foreground">{m.posts_description()}</p>
	</div>
	<Card.Root>
		<Card.Content>
			<form method="POST" action="?/create" class="flex flex-wrap items-end gap-3">
				<div class="grid min-w-56 gap-2">
					<Label for="new-post-language">{m.posts_new_language()}</Label>
					<NativeSelect
						id="new-post-language"
						name="languageCode"
						options={languageOptions}
						value={data.defaultLanguage ?? ''}
						required
					/>
				</div>
				<Button type="submit">
					<FilePlus />
					{m.posts_new()}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
	{#if errorMessage !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if data.canListAll}
		<nav class="flex gap-2" aria-label={m.posts_scope()}>
			<Button
				href={resolve('/panel/posts')}
				variant="outline"
				size="sm"
				class={cn(!data.showAll && 'bg-muted')}
				aria-current={!data.showAll}
			>
				{m.posts_scope_mine()}
			</Button>
			<form method="GET">
				<Button
					type="submit"
					name="scope"
					value="all"
					variant="outline"
					size="sm"
					class={cn(data.showAll && 'bg-muted')}
					aria-current={data.showAll}
				>
					{m.posts_scope_all()}
				</Button>
			</form>
		</nav>
	{/if}
	{#if data.posts.items.length === 0}
		<p class="text-sm text-muted-foreground">{m.posts_empty()}</p>
	{:else}
		<ul class="grid gap-3" data-testid="post-list">
			{#each data.posts.items as post (post.id)}
				<li class="grid gap-3 rounded-2xl border bg-card p-4">
					<div class="flex flex-wrap items-baseline justify-between gap-2">
						<a
							href={resolve(`/panel/posts/${post.id}`)}
							class="text-base font-semibold underline-offset-4 hover:underline"
						>
							{postTitle(post.translations[0]?.title ?? '')}
						</a>
						<span class="text-xs text-muted-foreground">
							<FormattedDate value={post.updatedAt} />
						</span>
					</div>
					{#if !post.own}
						<p class="text-xs text-muted-foreground">
							{m.posts_owner({ name: post.ownerName })}
						</p>
					{/if}
					<ul class="flex flex-wrap gap-2">
						{#each post.translations as translation (translation.id)}
							<li
								class="flex items-center gap-2 rounded-full border px-2 py-1 text-xs"
							>
								<span class="font-medium">
									{languageLabel(data.languages, translation.languageCode)}
								</span>
								<TranslationStatusBadge
									status={translation.status}
									pendingChanges={translation.hasPendingChanges}
								/>
							</li>
						{/each}
					</ul>
					{#if post.hiddenByModerator}
						<p class="text-xs text-destructive">{m.posts_hidden()}</p>
					{/if}
				</li>
			{/each}
		</ul>
		<Pager
			page={data.posts.page}
			pageCount={data.posts.pageCount}
			label={m.posts_title()}
			params={scopeParams}
		/>
	{/if}
</section>
