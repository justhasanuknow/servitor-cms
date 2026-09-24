<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { reauthenticationMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const successMessage = $derived.by(() => {
		if (!form || 'error' in form) {
			return null;
		}

		if (form.action === 'add') {
			return m.languages_added({ code: form.code });
		}

		if (form.action === 'delete') {
			return m.languages_deleted({ code: form.code });
		}

		return m.languages_updated({ code: form.code });
	});

	const errorMessage = $derived.by(() => {
		if (!form || !('error' in form)) {
			return null;
		}

		switch (form.error) {
			case 'invalid_code':
				return m.languages_error_invalid_code();
			case 'exists':
				return m.languages_error_exists();
			case 'default_language':
				return m.languages_error_default();
			case 'in_use':
				return m.languages_error_in_use();
			case 'not_found':
				return m.languages_error_not_found();
			default:
				return reauthenticationMessage(form.error);
		}
	});
</script>

<svelte:head>
	<title>{m.languages_title()} · {m.app_name()}</title>
</svelte:head>
<section class="grid gap-6">
	<div class="grid gap-1">
		<h1 class="text-2xl font-semibold">{m.languages_title()}</h1>
		<p class="text-muted-foreground">{m.languages_description()}</p>
	</div>
	{#if successMessage}
		<Alert.Root>
			<Alert.Description>{successMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	{#if errorMessage}
		<Alert.Root variant="destructive">
			<Alert.Description>{errorMessage}</Alert.Description>
		</Alert.Root>
	{/if}
	<Card.Root>
		<Card.Content>
			<ul class="grid gap-3" data-testid="language-list">
				{#each data.languages as language (language.code)}
					<li class="grid gap-3 rounded-2xl border p-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="grid gap-1">
								<p class="font-medium">
									{language.name}
									<span class="text-muted-foreground"
										>· {language.nativeName}</span
									>
								</p>
								<p class="flex flex-wrap gap-2 text-sm text-muted-foreground">
									<code class="font-mono">{language.code}</code>
									<span>
										{#if language.isDefault}
											{m.languages_status_default()}
										{:else if language.enabled}
											{m.languages_status_enabled()}
										{:else}
											{m.languages_status_disabled()}
										{/if}
									</span>
									<span
										>{m.languages_usage({
											count: String(language.translationCount)
										})}</span
									>
								</p>
							</div>
							{#if !language.isDefault}
								<form method="POST" action="?/setEnabled" use:enhance>
									<input type="hidden" name="code" value={language.code} />
									{#if language.enabled}
										<input type="hidden" name="value" value="false" />
										<Button type="submit" variant="outline" size="sm">
											{m.languages_disable()}
										</Button>
									{:else}
										<input type="hidden" name="value" value="true" />
										<Button type="submit" variant="outline" size="sm">
											{m.languages_enable()}
										</Button>
									{/if}
								</form>
							{/if}
						</div>
						<details>
							<summary class="cursor-pointer text-sm text-muted-foreground">
								{m.languages_edit()}
							</summary>
							<form
								method="POST"
								action="?/update"
								class="mt-3 grid gap-3 sm:grid-cols-3"
								use:enhance
							>
								<input type="hidden" name="code" value={language.code} />
								<div class="grid gap-2">
									<Label for="name-{language.code}"
										>{m.languages_field_name()}</Label
									>
									<Input
										id="name-{language.code}"
										name="name"
										maxlength={100}
										required
										value={language.name}
									/>
								</div>
								<div class="grid gap-2">
									<Label for="native-{language.code}"
										>{m.languages_field_native()}</Label
									>
									<Input
										id="native-{language.code}"
										name="nativeName"
										maxlength={100}
										required
										value={language.nativeName}
									/>
								</div>
								<div class="grid gap-2">
									<Label for="sort-{language.code}"
										>{m.languages_field_sort()}</Label
									>
									<Input
										id="sort-{language.code}"
										name="sortOrder"
										type="number"
										min={-1000}
										max={1000}
										value={String(language.sortOrder)}
									/>
								</div>
								<div class="sm:col-span-3">
									<Button type="submit" size="sm">{m.languages_save()}</Button>
								</div>
							</form>
						</details>
						{#if !language.isDefault && language.translationCount === 0}
							<details>
								<summary class="cursor-pointer text-sm text-destructive">
									{m.languages_delete()}
								</summary>
								<form
									method="POST"
									action="?/delete"
									class="mt-3 grid gap-3"
									use:enhance
								>
									<input type="hidden" name="code" value={language.code} />
									<p class="text-sm">{m.languages_delete_confirm()}</p>
									<div>
										<Button type="submit" variant="destructive" size="sm">
											{m.languages_delete()}
										</Button>
									</div>
								</form>
							</details>
						{/if}
					</li>
				{/each}
			</ul>
		</Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header>
			<Card.Title>
				<h2 class="text-lg font-semibold">{m.languages_add_title()}</h2>
			</Card.Title>
			<Card.Description>{m.languages_add_description()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" action="?/add" class="grid gap-4 sm:grid-cols-2" use:enhance>
				<div class="grid gap-2">
					<Label for="new-code">{m.languages_field_code()}</Label>
					<Input id="new-code" name="code" maxlength={35} required />
				</div>
				<div class="grid gap-2">
					<Label for="new-sort">{m.languages_field_sort()}</Label>
					<Input
						id="new-sort"
						name="sortOrder"
						type="number"
						min={-1000}
						max={1000}
						value="0"
					/>
				</div>
				<div class="grid gap-2">
					<Label for="new-name">{m.languages_field_name()}</Label>
					<Input id="new-name" name="name" maxlength={100} />
				</div>
				<div class="grid gap-2">
					<Label for="new-native">{m.languages_field_native()}</Label>
					<Input id="new-native" name="nativeName" maxlength={100} />
				</div>
				<div class="sm:col-span-2">
					<Button type="submit">{m.languages_add_submit()}</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</section>
