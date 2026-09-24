<script lang="ts">
	import LogOut from '@lucide/svelte/icons/log-out';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ServitorMark from '$lib/components/brand/servitor-mark.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { m } from '$lib/paraglide/messages';
	import { isActiveLink } from './panel-navigation';
	import type { PanelSidebarProps } from './panel-sidebar.interfaces';

	let { groups, viewerName, viewerRole, onNavigate }: PanelSidebarProps = $props();
</script>

<div class="flex h-full flex-col gap-6 bg-sidebar px-3 py-4 text-sidebar-foreground">
	<a
		href={resolve('/panel')}
		class="flex items-center gap-2 px-3 text-base font-semibold"
		onclick={onNavigate}
	>
		<ServitorMark class="size-6 shrink-0" />
		{m.app_name()}
	</a>
	<nav aria-label={m.nav_main()} class="grid flex-1 content-start gap-6 overflow-y-auto">
		{#each groups as group (group.id)}
			<div class="grid gap-1">
				<p class="px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
					{group.label}
				</p>
				{#each group.items as item (item.href)}
					{@const active = isActiveLink(page.url.pathname, item.activePrefix, item.exact)}
					<a
						href={item.href}
						aria-current={active && 'page'}
						onclick={onNavigate}
						class={cn(
							'flex items-center gap-3 rounded-3xl px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
							active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
						)}
					>
						<item.icon class="size-4 shrink-0" aria-hidden="true" />
						<span>{item.label}</span>
					</a>
				{/each}
			</div>
		{/each}
	</nav>
	<div class="grid gap-3 border-t border-sidebar-border px-3 pt-4">
		<div class="grid gap-0.5">
			<p class="truncate text-sm font-medium">{viewerName}</p>
			<p class="text-xs text-muted-foreground">{viewerRole}</p>
		</div>
		<form method="POST" action={resolve('/panel/logout')}>
			<Button type="submit" variant="outline" size="sm" class="w-full">
				<LogOut class="size-4" aria-hidden="true" />
				{m.common_sign_out()}
			</Button>
		</form>
	</div>
</div>
