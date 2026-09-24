<script lang="ts">
	import AccountLinkForm from '$lib/components/account-link-form.svelte';
	import { newPasswordMessage } from '$lib/i18n/auth-messages';
	import { m } from '$lib/paraglide/messages';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const description = $derived.by(() => {
		if (data.owner === null) {
			return null;
		}

		return m.invite_description({ name: data.owner.name, email: data.owner.email });
	});
</script>

<AccountLinkForm
	title={m.invite_title()}
	{description}
	submitLabel={m.invite_submit()}
	completedMessage={m.invite_completed()}
	completed={form?.completed === true}
	error={newPasswordMessage(form?.error)}
/>
