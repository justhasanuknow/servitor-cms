<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { cn } from '$lib/utils';
	import type { NavigationLink } from '$lib/modules/interfaces/navigation.interfaces';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived.by(() => {
		const entries: NavigationLink[] = [
			{
				href: resolve('/panel/account/profile'),
				label: m.nav_profile(),
				activePrefix: resolve('/panel/account/profile')
			},
			{
				href: resolve('/panel/account/password'),
				label: m.nav_password(),
				activePrefix: resolve('/panel/account/password')
			},
			{
				href: resolve('/panel/account/two-factor'),
				label: m.nav_two_factor(),
				activePrefix: resolve('/panel/account/two-factor')
			},
			{
				href: resolve('/panel/account/sessions'),
				label: m.nav_sessions(),
				activePrefix: resolve('/panel/account/sessions')
			}
		];

		return entries;
	});
</script>

<div class="grid gap-8 md:grid-cols-[14rem_1fr]">
	{#if !data.restricted}
		<nav aria-label={m.nav_account()} class="grid content-start gap-1">
			<p class="px-3 pb-2 text-sm font-medium text-muted-foreground">{m.nav_account()}</p>
			{#each links as link (link.href)}
				{@const active = page.url.pathname === link.activePrefix}
				<a
					href={link.href}
					aria-current={active && 'page'}
					class={cn(
						'rounded-3xl px-3 py-2 text-sm transition-colors hover:bg-muted',
						active && 'bg-muted font-medium'
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
