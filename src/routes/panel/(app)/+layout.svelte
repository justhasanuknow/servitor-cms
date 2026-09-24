<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { NavigationLink } from '$lib/modules/interfaces/navigation.interfaces';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = $derived.by(() => {
		const entries: NavigationLink[] = [];

		if (data.navigation.users) {
			entries.push({
				href: resolve('/panel/users'),
				label: m.nav_users(),
				activePrefix: resolve('/panel/users')
			});
		}

		if (data.navigation.audit) {
			entries.push({
				href: resolve('/panel/audit'),
				label: m.nav_audit_log(),
				activePrefix: resolve('/panel/audit')
			});
		}

		entries.push({
			href: resolve('/panel/account/password'),
			label: m.nav_account(),
			activePrefix: `${resolve('/panel')}/account`
		});

		return entries;
	});
</script>

<div class="min-h-svh bg-muted/40">
	<header class="border-b bg-background">
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
			<div class="flex items-center gap-6">
				<a href={resolve('/panel')} class="font-semibold">{m.app_name()}</a>
				{#if !data.restricted}
					<nav aria-label={m.nav_main()} class="hidden items-center gap-1 md:flex">
						{#each links as link (link.href)}
							<a
								href={link.href}
								class={cn(
									'rounded-3xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
									page.url.pathname.startsWith(link.activePrefix) &&
										'bg-muted text-foreground'
								)}
							>
								{link.label}
							</a>
						{/each}
					</nav>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<span class="hidden text-sm text-muted-foreground sm:inline">
					{data.viewer.name}
				</span>
				<form method="POST" action={resolve('/panel/logout')}>
					<Button type="submit" variant="outline" size="sm">{m.common_sign_out()}</Button>
				</form>
			</div>
		</div>
	</header>
	<main class="mx-auto max-w-5xl px-4 py-8">
		{@render children()}
	</main>
</div>
