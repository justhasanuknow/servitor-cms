<script lang="ts">
	import Menu from '@lucide/svelte/icons/menu';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { prefersReducedMotion } from 'svelte/motion';
	import { afterNavigate, onNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ServitorMark from '$lib/components/brand/servitor-mark.svelte';
	import NavigationProgress from '$lib/components/panel/navigation-progress.svelte';
	import { startPageTransition } from '$lib/components/panel/page-transition';
	import { panelNavigation } from '$lib/components/panel/panel-navigation';
	import PanelSidebar from '$lib/components/panel/panel-sidebar.svelte';
	import { Button } from '$lib/components/ui/button';
	import { roleLabel } from '$lib/i18n/labels';
	import { cn } from '$lib/utils';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let menuOpen = $state(false);

	const groups = $derived(panelNavigation(data.navigation));

	const motionDuration = $derived.by(() => {
		if (prefersReducedMotion.current) {
			return 0;
		}

		return 200;
	});

	function closeMenu(): void {
		menuOpen = false;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && menuOpen) {
			closeMenu();
		}
	}

	onNavigate((navigation) => startPageTransition(navigation));

	afterNavigate(() => {
		closeMenu();
	});
</script>

<svelte:window onkeydown={handleKeydown} />
<NavigationProgress />
<div class={cn('min-h-svh bg-muted/40', !data.restricted && 'lg:grid lg:grid-cols-[16rem_1fr]')}>
	{#if data.restricted}
		<header class="border-b bg-background">
			<div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
				<span class="flex items-center gap-2 font-semibold">
					<ServitorMark class="size-5 shrink-0" />
					{m.app_name()}
				</span>
				<form method="POST" action={resolve('/panel/logout')}>
					<Button type="submit" variant="outline" size="sm">{m.common_sign_out()}</Button>
				</form>
			</div>
		</header>
	{:else}
		<aside class="hidden border-r lg:sticky lg:top-0 lg:block lg:h-svh">
			<PanelSidebar
				{groups}
				viewerName={data.viewer.name}
				viewerRole={roleLabel(data.viewer.role)}
			/>
		</aside>
		<header
			class="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 lg:hidden"
		>
			<a href={resolve('/panel')} class="flex items-center gap-2 font-semibold">
				<ServitorMark class="size-5 shrink-0" />
				{m.app_name()}
			</a>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				aria-expanded={menuOpen}
				aria-controls="panel-menu"
				aria-label={m.nav_open_menu()}
				onclick={() => (menuOpen = true)}
			>
				<Menu class="size-5" aria-hidden="true" />
			</Button>
		</header>
		{#if menuOpen}
			<div
				class="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
				transition:fade={{ duration: motionDuration }}
				onclick={closeMenu}
				aria-hidden="true"
			></div>
			<div
				id="panel-menu"
				role="dialog"
				aria-modal="true"
				aria-label={m.nav_main()}
				class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r shadow-lg lg:hidden"
				transition:fly={{ x: -288, duration: motionDuration }}
			>
				<div class="absolute top-3 right-3">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m.nav_close_menu()}
						onclick={closeMenu}
					>
						<X class="size-5" aria-hidden="true" />
					</Button>
				</div>
				<PanelSidebar
					{groups}
					viewerName={data.viewer.name}
					viewerRole={roleLabel(data.viewer.role)}
					onNavigate={closeMenu}
				/>
			</div>
		{/if}
	{/if}
	<main class="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8">
		{@render children()}
	</main>
</div>
