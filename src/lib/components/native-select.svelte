<script lang="ts">
	import { cn } from '$lib/utils';
	import type { NativeSelectProps } from './native-select.interfaces';

	let {
		id,
		name,
		options,
		value,
		required = false,
		class: className
	}: NativeSelectProps = $props();
</script>

<select
	{id}
	{name}
	{required}
	class={cn(
		'h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm',
		className
	)}
>
	{#each options as option (option.value)}
		<option value={option.value} selected={option.value === value}>{option.label}</option>
	{/each}
</select>
