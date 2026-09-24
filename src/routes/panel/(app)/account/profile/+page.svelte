<script lang="ts">
	import { fade } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
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
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { modeLabel, paletteLabel } from '$lib/i18n/labels';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const localeOptions = $derived([
		{ value: '', label: m.profile_language_automatic() },
		...UI_LOCALES.map((locale) => ({ value: locale, label: UI_LOCALE_AUTONYMS[locale] }))
	]);

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
		{#if form?.error}
			<Alert.Root variant="destructive">
				<Alert.Description>{reauthenticationMessage(form.error)}</Alert.Description>
			</Alert.Root>
		{/if}
		<form method="POST" class="grid max-w-xl gap-6">
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
