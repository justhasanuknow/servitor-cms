<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived([
		{ href: resolve('/panel/account/password'), label: m.nav_password() },
		{ href: resolve('/panel/account/two-factor'), label: m.nav_two_factor() },
		{ href: resolve('/panel/account/sessions'), label: m.nav_sessions() }
	]);
</script>

<div class="grid gap-8 md:grid-cols-[14rem_1fr]">
	{#if !data.restricted}
		<nav aria-label={m.nav_account()} class="grid content-start gap-1">
			<p class="px-3 pb-2 text-sm font-medium text-muted-foreground">{m.nav_account()}</p>
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={page.url.pathname === link.href && 'page'}
					class={cn(
						'rounded-3xl px-3 py-2 text-sm transition-colors hover:bg-muted',
						page.url.pathname === link.href && 'bg-muted font-medium'
					)}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	{/if}
	<div class="grid content-start gap-6 md:col-start-2">
		{@render children()}
	</div>
</div>
