<script lang="ts">
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import History from '@lucide/svelte/icons/history';
	import Save from '@lucide/svelte/icons/save';
	import Send from '@lucide/svelte/icons/send';
	import type { ActionResult, SubmitFunction } from '@sveltejs/kit';
	import { onMount, untrack } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EdraEditor from '$lib/components/edra/shadcn/edra-editor.svelte';
	import FormattedDate from '$lib/components/formatted-date.svelte';
	import MediaField from '$lib/components/media/media-field.svelte';
	import type { MediaPreview } from '$lib/components/media/media-field.interfaces';
	import NativeSelect from '$lib/components/native-select.svelte';
	import TranslationStatusBadge from '$lib/components/posts/translation-status-badge.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		META_DESCRIPTION_MAX_LENGTH,
		META_TITLE_MAX_LENGTH,
		POST_EXCERPT_MAX_LENGTH,
		POST_TITLE_MAX_LENGTH,
		TAG_INPUT_MAX_LENGTH
	} from '$lib/constants/content';
	import { languageLabel, postErrorMessage, postTitle } from '$lib/i18n/post-messages';
	import { m } from '$lib/paraglide/messages';
	import { cn } from '$lib/utils';
	import { errorCodeOf, publishOutcomeOf, savedDraftOf, workflowNoticeOf } from './draft-results';
	import { localDateTimeValue, scheduleIso } from './schedule-input';
	import type {
		DraftSaveMode,
		SaveState,
		TranslationEditorProps,
		WorkflowNotice
	} from './translation-editor.interfaces';

	const AUTOSAVE_DELAY_MS = 3000;

	const MAX_SLUG_INPUT_LENGTH = 120;

	let { data, form }: TranslationEditorProps = $props();

	const initial = untrack(() => data);
	const postId = initial.post.id;
	const languageCode = initial.editor.languageCode;
	const initialContent = initial.editor.draft.content;

	let title = $state(initial.editor.draft.title);
	let slug = $state(initial.editor.draft.slug);
	let excerpt = $state(initial.editor.draft.excerpt);
	let metaTitle = $state(initial.editor.draft.metaTitle);
	let metaDescription = $state(initial.editor.draft.metaDescription);
	let tags = $state(initial.editor.draft.tags.join(', '));
	let ogMedia: MediaPreview | null = $state(initial.ogMedia);
	let cover: MediaPreview | null = $state(initial.post.cover);
	let readingTime = $state(initial.editor.draft.readingTimeMinutes);
	let savedAt: Date = $state(initial.editor.draft.updatedAt);
	let saveState: SaveState = $state('saved');
	let saveError: string | null = $state(null);
	let conflict = $state(false);
	let historyNotice = $state(false);
	let deleteOpen = $state(false);
	let publishAt = $state('');
	let editedSinceLoad = $state(false);

	let content = initialContent;
	let version = initial.editor.draft.version;
	let changeCounter = 0;
	let savedCounter = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let queue: Promise<void> = Promise.resolve();

	const translations = $derived(data.translations);
	const addableLanguages = $derived(
		data.languages
			.filter((language) => language.enabled)
			.filter(
				(language) => !translations.some((entry) => entry.languageCode === language.code)
			)
			.map((language) => ({
				value: language.code,
				label: `${language.nativeName} (${language.code})`
			}))
	);
	const categoryOptions = $derived([
		{ value: '', label: m.posts_no_category() },
		...data.categories.map((category) => ({
			value: category.id,
			label: categoryName(category.translations)
		}))
	]);
	const formError = $derived(postErrorMessage(errorCodeOf(form)));
	const settingsSaved = $derived(form !== null && form !== undefined && 'settingsSaved' in form);
	const restored = $derived(page.url.searchParams.has('restored'));
	const editorPath = resolve(`/panel/posts/${postId}/${languageCode}`);
	const workflow = $derived(data.workflow);
	const workflowNotice = $derived(
		workflowMessage(workflowNoticeOf(page.url.searchParams.get('workflow')))
	);
	const canSchedule = $derived(workflow.publishedAt === null);
	const canUnpublish = $derived(
		workflow.status === 'published' || workflow.status === 'scheduled'
	);
	const republishes = $derived(
		workflow.status === 'unpublished' && workflow.unchangedSinceLive && !editedSinceLoad
	);
	const publishLabel = $derived.by(() => {
		if (!republishes && !workflow.trusted) {
			return m.workflow_submit();
		}

		if (canSchedule && publishAt !== '') {
			return m.workflow_schedule();
		}

		if (republishes && !canSchedule) {
			return m.workflow_publish_again();
		}

		return m.workflow_publish();
	});

	onMount(() => {
		if (workflow.scheduledAt !== null && canSchedule) {
			publishAt = localDateTimeValue(workflow.scheduledAt);
		}
	});

	function workflowMessage(notice: WorkflowNotice | null): string | null {
		switch (notice) {
			case 'published':
				return m.workflow_outcome_published();
			case 'scheduled':
				return m.workflow_outcome_scheduled();
			case 'submitted':
				return m.workflow_outcome_submitted();
			case 'republished':
				return m.workflow_outcome_republished();
			case 'unpublished':
				return m.workflow_unpublished();
			default:
				return null;
		}
	}

	function categoryName(entries: { languageCode: string; name: string }[]): string {
		const own = entries.find((entry) => entry.languageCode === languageCode);

		if (own !== undefined) {
			return own.name;
		}

		const fallback = entries.find((entry) => entry.languageCode === data.defaultLanguage);

		return fallback?.name ?? entries[0]?.name ?? '';
	}

	function hasUnsavedChanges(): boolean {
		return changeCounter !== savedCounter;
	}

	function changed(): void {
		editedSinceLoad = true;
		changeCounter += 1;
		saveState = 'dirty';
		historyNotice = false;
		schedule();
	}

	function contentChanged(next: string): void {
		content = next;
		changed();
	}

	function schedule(): void {
		clearTimeout(timer);
		timer = setTimeout(() => {
			persist('autosave');
		}, AUTOSAVE_DELAY_MS);
	}

	function flush(): void {
		if (hasUnsavedChanges()) {
			persist('autosave');
		}
	}

	function persist(mode: DraftSaveMode): Promise<void> {
		clearTimeout(timer);
		queue = queue.then(() => run(mode));

		return queue;
	}

	async function run(mode: DraftSaveMode): Promise<void> {
		if (conflict) {
			return;
		}

		if (mode === 'autosave' && !hasUnsavedChanges()) {
			return;
		}

		saveState = 'saving';
		await send(mode, changeCounter, slug);
	}

	function draftBody(): FormData {
		const body = new FormData();

		body.set('title', title);
		body.set('slug', slug);
		body.set('excerpt', excerpt);
		body.set('metaTitle', metaTitle);
		body.set('metaDescription', metaDescription);
		body.set('ogMediaId', ogMedia?.id ?? '');
		body.set('tags', tags);
		body.set('content', content);
		body.set('version', String(version));

		return body;
	}

	async function postAction(action: string, body: FormData): Promise<ActionResult | null> {
		try {
			const response = await fetch(`?/${action}`, {
				method: 'POST',
				body,
				headers: { 'x-sveltekit-action': 'true' }
			});

			return deserialize(await response.text());
		} catch {
			return null;
		}
	}

	async function send(mode: DraftSaveMode, sentCounter: number, sentSlug: string): Promise<void> {
		const result = await postAction(mode, draftBody());

		if (result === null) {
			saveState = 'error';
			saveError = m.posts_error_network();

			return;
		}

		handleResult(result, sentCounter, sentSlug);
	}

	function publish(): void {
		clearTimeout(timer);
		queue = queue.then(() => runPublish());
	}

	async function runPublish(): Promise<void> {
		if (conflict) {
			return;
		}

		const sentCounter = changeCounter;
		const sentSlug = slug;
		const body = draftBody();

		body.set('scheduledAt', requestedSchedule());
		saveState = 'saving';

		const result = await postAction('publish', body);

		if (result === null) {
			saveState = 'error';
			saveError = m.posts_error_network();

			return;
		}

		const outcome = publishOutcomeOf(result.type === 'success' && result.data);

		if (outcome !== null) {
			savedCounter = sentCounter;
			window.location.assign(`${editorPath}?workflow=${outcome}`);

			return;
		}

		handleResult(result, sentCounter, sentSlug);
	}

	function unpublish(): void {
		clearTimeout(timer);
		queue = queue.then(() => runUnpublish());
	}

	async function runUnpublish(): Promise<void> {
		await run('autosave');

		if (conflict || hasUnsavedChanges()) {
			return;
		}

		const result = await postAction('unpublish', new FormData());

		if (result === null) {
			saveState = 'error';
			saveError = m.posts_error_network();

			return;
		}

		if (result.type === 'success') {
			window.location.assign(`${editorPath}?workflow=unpublished`);

			return;
		}

		handleResult(result, changeCounter, slug);
	}

	function requestedSchedule(): string {
		if (!canSchedule) {
			return '';
		}

		return scheduleIso(publishAt);
	}

	function handleResult(result: ActionResult, sentCounter: number, sentSlug: string): void {
		const saved = savedDraftOf(result.type === 'success' && result.data);

		if (saved !== null) {
			version = saved.version;
			savedCounter = sentCounter;
			readingTime = saved.readingTimeMinutes;
			savedAt = new Date(saved.savedAt);
			saveError = null;
			historyNotice = saved.mode === 'save' && saved.snapshot;

			if (slug === sentSlug) {
				slug = saved.slug;
			}

			if (hasUnsavedChanges()) {
				saveState = 'dirty';
				schedule();
			} else {
				saveState = 'saved';
			}

			return;
		}

		if (result.type === 'redirect') {
			window.location.assign(result.location);

			return;
		}

		const code = errorCodeOf(result.type === 'failure' && result.data);

		conflict = code === 'conflict';
		saveState = 'error';
		saveError = postErrorMessage(code) ?? m.posts_error_generic();
	}

	const keepSettingsState: SubmitFunction = () => {
		return async ({ update }) => {
			await update({ reset: false, invalidateAll: false });
		};
	};

	beforeNavigate((navigation) => {
		if (!hasUnsavedChanges() || conflict) {
			return;
		}

		navigation.cancel();

		const target = navigation.to?.url;

		if (navigation.type === 'leave' || target === undefined) {
			return;
		}

		persist('autosave').then(() => {
			if (!hasUnsavedChanges()) {
				window.location.assign(target.href);
			}
		});
	});
</script>

<section class="grid gap-6">
	<div class="grid gap-3">
		<a
			href={resolve('/panel/posts')}
			class="text-sm text-muted-foreground underline-offset-4 hover:underline"
		>
			{m.posts_back()}
		</a>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h1 class="text-2xl font-semibold">{postTitle(title)}</h1>
			<div class="flex flex-wrap items-center gap-3">
				<span class="text-sm text-muted-foreground" role="status" aria-live="polite">
					{#if saveState === 'saving'}
						{m.posts_saving()}
					{:else if saveState === 'dirty'}
						{m.posts_unsaved_changes()}
					{:else if saveState === 'error'}
						{m.posts_save_failed()}
					{:else}
						{m.posts_saved_at()}
						<FormattedDate value={savedAt} />
					{/if}
				</span>
				<Button
					variant="outline"
					href={resolve(`/panel/posts/${postId}/${languageCode}/revisions`)}
				>
					<History />
					{m.revisions_title()}
				</Button>
				<Button onclick={() => persist('save')} disabled={conflict}>
					<Save />
					{m.posts_save()}
				</Button>
			</div>
		</div>
		<nav aria-label={m.posts_translations()} class="flex flex-wrap items-center gap-2">
			{#each translations as translation (translation.id)}
				<a
					href={resolve(`/panel/posts/${postId}/${translation.languageCode}`)}
					aria-current={translation.languageCode === languageCode}
					class={cn(
						'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted',
						translation.languageCode === languageCode && 'bg-muted font-medium'
					)}
				>
					<span>{languageLabel(data.languages, translation.languageCode)}</span>
					<TranslationStatusBadge
						status={translation.status}
						pendingChanges={translation.hasPendingChanges}
					/>
				</a>
			{/each}
			{#if addableLanguages.length > 0}
				<form method="POST" action="?/addTranslation" class="flex items-center gap-2">
					<Label for="add-translation-language" class="sr-only">
						{m.posts_add_translation_language()}
					</Label>
					<NativeSelect
						id="add-translation-language"
						name="languageCode"
						options={addableLanguages}
						class="h-8 w-auto"
					/>
					<Button type="submit" size="sm" variant="outline"
						>{m.posts_add_translation()}</Button
					>
				</form>
			{/if}
		</nav>
	</div>
	{#if conflict}
		<Alert.Root variant="destructive">
			<Alert.Description>
				{m.posts_error_conflict()}
				<a
					href={resolve(`/panel/posts/${postId}/${languageCode}`)}
					data-sveltekit-reload
					class="underline"
				>
					{m.posts_reload()}
				</a>
			</Alert.Description>
		</Alert.Root>
	{:else if saveError !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>{saveError}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if historyNotice}
		<Alert.Root>
			<Alert.Description>{m.posts_saved_to_history()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if restored}
		<Alert.Root>
			<Alert.Description>{m.revisions_restored()}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if workflowNotice !== null}
		<Alert.Root>
			<Alert.Description>{workflowNotice}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if workflow.rejection !== null}
		<Alert.Root variant="destructive">
			<Alert.Description>
				{m.workflow_rejected({ note: workflow.rejection.note })}
			</Alert.Description>
		</Alert.Root>
	{/if}
	{#if data.post.hiddenByModerator}
		<Alert.Root variant="destructive">
			<Alert.Description>
				{m.posts_hidden_reason({ reason: data.post.hiddenReason ?? '' })}
			</Alert.Description>
		</Alert.Root>
	{/if}
	<div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
		<div class="grid content-start gap-4" lang={languageCode}>
			<Label for="post-title" class="sr-only">{m.posts_field_title()}</Label>
			<Input
				id="post-title"
				bind:value={title}
				maxlength={POST_TITLE_MAX_LENGTH}
				placeholder={m.posts_field_title_placeholder()}
				class="h-auto rounded-2xl py-3 text-2xl font-semibold"
				oninput={changed}
				onblur={flush}
			/>
			<EdraEditor
				content={initialContent}
				{languageCode}
				onChange={contentChanged}
				onBlur={flush}
			/>
			<p class="text-sm text-muted-foreground">
				{m.posts_reading_time({ minutes: String(readingTime) })}
			</p>
		</div>
		<aside class="grid content-start gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.workflow_title()}</h2></Card.Title>
				</Card.Header>
				<Card.Content class="grid gap-4">
					<div class="grid gap-2 text-sm">
						<div>
							<TranslationStatusBadge
								status={workflow.status}
								pendingChanges={workflow.pending}
							/>
						</div>
						{#if workflow.publishedAt !== null}
							<p class="text-muted-foreground">
								{m.workflow_published_at()}
								<FormattedDate value={workflow.publishedAt} />
							</p>
						{/if}
						{#if workflow.status === 'scheduled' && workflow.scheduledAt !== null}
							<p class="text-muted-foreground">
								{m.workflow_scheduled_for()}
								<FormattedDate value={workflow.scheduledAt} />
							</p>
						{/if}
						{#if workflow.pending}
							<p class="text-muted-foreground">{m.workflow_pending_notice()}</p>
						{/if}
					</div>
					{#if canSchedule}
						<div class="grid gap-2">
							<Label for="publish-at">{m.workflow_schedule_label()}</Label>
							<Input id="publish-at" type="datetime-local" bind:value={publishAt} />
							<p class="text-xs text-muted-foreground">
								{m.workflow_schedule_hint()}
							</p>
						</div>
					{/if}
					{#if !workflow.trusted && !republishes}
						<p class="text-xs text-muted-foreground">{m.workflow_untrusted_hint()}</p>
					{/if}
					<div class="flex flex-wrap gap-2">
						<Button onclick={publish} disabled={conflict}>
							<Send />
							{publishLabel}
						</Button>
						{#if canUnpublish}
							<Button variant="outline" onclick={unpublish} disabled={conflict}>
								<EyeOff />
								{m.workflow_unpublish()}
							</Button>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.posts_details()}</h2></Card.Title>
				</Card.Header>
				<Card.Content class="grid gap-4">
					<div class="grid gap-2">
						<Label for="post-slug">{m.posts_field_slug()}</Label>
						<Input
							id="post-slug"
							bind:value={slug}
							maxlength={MAX_SLUG_INPUT_LENGTH}
							placeholder={m.posts_field_slug_placeholder()}
							oninput={changed}
							onblur={flush}
						/>
						<p class="text-xs text-muted-foreground">{m.posts_field_slug_hint()}</p>
						{#if data.editor.liveSlug !== null}
							<p class="text-xs text-muted-foreground">
								{m.posts_live_slug({ slug: data.editor.liveSlug })}
							</p>
						{/if}
					</div>
					<div class="grid gap-2">
						<Label for="post-excerpt">{m.posts_field_excerpt()}</Label>
						<Textarea
							id="post-excerpt"
							bind:value={excerpt}
							maxlength={POST_EXCERPT_MAX_LENGTH}
							rows={3}
							oninput={changed}
							onblur={flush}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="post-tags">{m.posts_field_tags()}</Label>
						<Input
							id="post-tags"
							bind:value={tags}
							maxlength={TAG_INPUT_MAX_LENGTH}
							placeholder={m.posts_field_tags_placeholder()}
							oninput={changed}
							onblur={flush}
						/>
						<p class="text-xs text-muted-foreground">{m.posts_field_tags_hint()}</p>
					</div>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.posts_seo()}</h2></Card.Title>
				</Card.Header>
				<Card.Content class="grid gap-4">
					<div class="grid gap-2">
						<Label for="post-meta-title">{m.posts_field_meta_title()}</Label>
						<Input
							id="post-meta-title"
							bind:value={metaTitle}
							maxlength={META_TITLE_MAX_LENGTH}
							oninput={changed}
							onblur={flush}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="post-meta-description">{m.posts_field_meta_description()}</Label
						>
						<Textarea
							id="post-meta-description"
							bind:value={metaDescription}
							maxlength={META_DESCRIPTION_MAX_LENGTH}
							rows={3}
							oninput={changed}
							onblur={flush}
						/>
					</div>
					<MediaField
						id="post-og-image"
						label={m.posts_field_og_image()}
						description={m.posts_field_og_image_hint()}
						bind:value={ogMedia}
						{languageCode}
						onChange={changed}
					/>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.posts_settings()}</h2></Card.Title>
					<Card.Description>{m.posts_settings_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<form
						method="POST"
						action="?/settings"
						class="grid gap-4"
						use:enhance={keepSettingsState}
					>
						<div class="grid gap-2">
							<Label for="post-category">{m.posts_field_category()}</Label>
							<NativeSelect
								id="post-category"
								name="categoryId"
								options={categoryOptions}
								value={data.post.categoryId ?? ''}
							/>
						</div>
						<MediaField
							id="post-cover"
							label={m.posts_field_cover()}
							bind:value={cover}
							{languageCode}
							name="coverMediaId"
							disabled={data.post.settingsLocked}
						/>
						{#if data.post.settingsLocked}
							<p class="text-xs text-muted-foreground">{m.posts_settings_locked()}</p>
						{/if}
						{#if settingsSaved}
							<p class="text-sm text-muted-foreground" role="status">
								{m.posts_settings_saved()}
							</p>
						{/if}
						{#if formError !== null}
							<p class="text-sm text-destructive" role="alert">{formError}</p>
						{/if}
						<div>
							<Button
								type="submit"
								variant="outline"
								disabled={data.post.settingsLocked}
							>
								{m.posts_settings_save()}
							</Button>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
			<Card.Root>
				<Card.Header>
					<Card.Title><h2 class="font-semibold">{m.posts_delete_title()}</h2></Card.Title>
					<Card.Description>{m.posts_delete_description()}</Card.Description>
				</Card.Header>
				<Card.Content>
					<Button variant="destructive" onclick={() => (deleteOpen = true)}>
						{m.posts_delete()}
					</Button>
				</Card.Content>
			</Card.Root>
		</aside>
	</div>
</section>
<Dialog.Root bind:open={deleteOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.posts_delete_confirm_title()}</Dialog.Title>
			<Dialog.Description>{m.posts_delete_confirm_description()}</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/delete">
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (deleteOpen = false)}>
					{m.common_cancel()}
				</Button>
				<Button type="submit" variant="destructive">{m.posts_delete_confirm()}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
