<script lang="ts">
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { enhance } from '$app/forms';
	import NativeSelect from '$lib/components/native-select.svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		BIO_MAX_LENGTH,
		DISPLAY_NAME_MAX_LENGTH,
		THEME_MODES,
		THEME_PALETTES,
		UI_LOCALE_AUTONYMS,
		UI_LOCALES
	} from '$lib/constants/preferences';
	import { MEDIA_THUMBNAIL_VARIANT, MEDIA_UPLOAD_ACCEPT } from '$lib/constants/media';
	import { mediaUrl } from '$lib/content/media-urls';
	import { mediaErrorMessage } from '$lib/i18n/media-messages';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { modeLabel, paletteLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const localeOptions = $derived([
		{ value: '', label: m.profile_language_automatic() },
		...UI_LOCALES.map((locale) => ({ value: locale, label: UI_LOCALE_AUTONYMS[locale] }))
	]);

	const avatarError = $derived.by(() => {
		if (!form || !('avatarError' in form)) {
			return null;
		}

		return mediaErrorMessage(form.avatarError);
	});

	const profileError = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		return reauthenticationMessage(form.error);
	});

	const initial = $derived(data.profile.name.trim().charAt(0).toLocaleUpperCase());

	const fadeDuration = $derived.by(() => {
		if (prefersReducedMotion.current) {
			return 0;
		}

		return 200;
	});
</script>

<svelte:head>
	<title>{m.profile_title()} · {m.app_name()}</title>
</svelte:head>
<Card.Root>
	<Card.Header>
		<Card.Title>
			<h1 class="text-xl font-semibold">{m.profile_title()}</h1>
		</Card.Title>
		<Card.Description>{m.profile_description()}</Card.Description>
	</Card.Header>
	<Card.Content class="grid gap-6">
		{#if data.saved}
			<div transition:fade={{ duration: fadeDuration }}>
				<Alert.Root>
					<Alert.Description>{m.profile_saved()}</Alert.Description>
				</Alert.Root>
			</div>
		{/if}
		{#if profileError !== null}
			<Alert.Root variant="destructive">
				<Alert.Description>{profileError}</Alert.Description>
			</Alert.Root>
		{/if}
		<section class="grid max-w-xl gap-3" aria-labelledby="profile-avatar-title">
			<h2 id="profile-avatar-title" class="text-sm font-medium">{m.profile_avatar()}</h2>
			<div class="flex flex-wrap items-center gap-4">
				{#if data.avatar !== null}
					<img
						src={mediaUrl(data.avatar.id, MEDIA_THUMBNAIL_VARIANT)}
						alt={m.profile_avatar_alt()}
						width={data.avatar.width}
						height={data.avatar.height}
						class="size-20 rounded-full border object-cover"
					/>
				{:else}
					<span
						class="flex size-20 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground"
						aria-hidden="true"
					>
						{initial}
					</span>
				{/if}
				<form
					method="POST"
					action="?/avatar"
					enctype="multipart/form-data"
					class="flex flex-wrap items-center gap-2"
					use:enhance
				>
					<Label for="profile-avatar" class="sr-only">{m.profile_avatar_upload()}</Label>
					<Input
						id="profile-avatar"
						name="avatar"
						type="file"
						accept={MEDIA_UPLOAD_ACCEPT}
						required
						class="max-w-64"
					/>
					<Button type="submit" variant="outline" size="sm"
						>{m.profile_avatar_upload()}</Button
					>
				</form>
				{#if data.avatar !== null}
					<form method="POST" action="?/removeAvatar" use:enhance>
						<Button type="submit" variant="ghost" size="sm"
							>{m.profile_avatar_remove()}</Button
						>
					</form>
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">{m.profile_avatar_hint()}</p>
			{#if avatarError !== null}
				<p class="text-sm text-destructive" role="alert">{avatarError}</p>
			{/if}
		</section>
		<form method="POST" action="?/save" class="grid max-w-xl gap-6">
			<div class="grid gap-2">
				<Label for="profile-name">{m.users_field_name()}</Label>
				<Input
					id="profile-name"
					name="name"
					maxlength={DISPLAY_NAME_MAX_LENGTH}
					required
					value={data.profile.name}
				/>
			</div>
			<div class="grid gap-2">
				<Label for="profile-email">{m.common_email()}</Label>
				<Input id="profile-email" value={data.profile.email} disabled />
			</div>
			<div class="grid gap-2">
				<Label for="profile-bio">{m.profile_bio()}</Label>
				<Textarea
					id="profile-bio"
					name="bio"
					maxlength={BIO_MAX_LENGTH}
					rows={4}
					value={data.profile.bio}
				/>
				<p class="text-sm text-muted-foreground">{m.profile_bio_hint()}</p>
			</div>
			<div class="grid gap-2">
				<Label for="profile-language">{m.profile_language()}</Label>
				<NativeSelect
					id="profile-language"
					name="uiLocale"
					options={localeOptions}
					value={data.profile.preferences.uiLocale ?? ''}
				/>
			</div>
			<fieldset class="grid gap-3">
				<legend class="mb-3 text-sm font-medium">{m.profile_palette()}</legend>
				<div class="flex flex-wrap gap-3">
					{#each THEME_PALETTES as palette (palette)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-3xl border px-3 py-2 text-sm has-checked:border-ring has-checked:ring-3 has-checked:ring-ring/30 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
						>
							<input
								type="radio"
								name="themePalette"
								value={palette}
								checked={data.profile.preferences.theme.palette === palette}
								class="sr-only"
							/>
							<span
								data-palette={palette}
								class="size-4 rounded-full bg-primary"
								aria-hidden="true"
							></span>
							{paletteLabel(palette)}
						</label>
					{/each}
				</div>
			</fieldset>
			<fieldset class="grid gap-3">
				<legend class="mb-3 text-sm font-medium">{m.profile_mode()}</legend>
				<div class="flex flex-wrap gap-3">
					{#each THEME_MODES as mode (mode)}
						<label
							class="flex cursor-pointer items-center gap-2 rounded-3xl border px-3 py-2 text-sm has-checked:border-ring has-checked:ring-3 has-checked:ring-ring/30 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
						>
							<input
								type="radio"
								name="themeMode"
								value={mode}
								checked={data.profile.preferences.theme.mode === mode}
								class="sr-only"
							/>
							{modeLabel(mode)}
						</label>
					{/each}
				</div>
			</fieldset>
			<div>
				<Button type="submit">{m.profile_save()}</Button>
			</div>
		</form>
	</Card.Content>
</Card.Root>
