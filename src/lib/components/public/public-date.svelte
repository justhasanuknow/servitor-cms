<script lang="ts">
	import { getLocale } from '$lib/paraglide/runtime';
	import type { PublicDateProps } from './public-date.interfaces';

	let { value }: PublicDateProps = $props();

	const text = $derived(
		new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long', timeZone: 'UTC' }).format(value)
	);
</script>

<time datetime={value.toISOString()}>{text}</time>
