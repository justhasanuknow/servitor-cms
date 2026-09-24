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

		return m.reset_description({ email: data.owner.email });
	});
</script>

<AccountLinkForm
	title={m.reset_title()}
	{description}
	submitLabel={m.reset_submit()}
	completedMessage={m.reset_completed()}
	completed={form?.completed === true}
	error={newPasswordMessage(form?.error)}
/>
