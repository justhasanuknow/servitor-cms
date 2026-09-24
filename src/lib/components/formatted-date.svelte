<script lang="ts">
	import { onMount } from 'svelte';
	import { getLocale } from '$lib/paraglide/runtime';
	import type { FormattedDateProps } from './formatted-date.interfaces';

	let { value }: FormattedDateProps = $props();

	let hydrated = $state(false);

	const text = $derived.by(() => {
		const options: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		};

		if (!hydrated) {
			options.timeZone = 'UTC';
			options.timeZoneName = 'short';
		}

		return new Intl.DateTimeFormat(getLocale(), options).format(value);
	});

	onMount(() => {
		hydrated = true;
	});
</script>

<time datetime={value.toISOString()}>{text}</time>
