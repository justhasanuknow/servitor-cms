<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { m } from '$lib/paraglide/messages';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="min-h-svh bg-muted/40">
	<header class="border-b bg-background">
		<div class="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
			<a href={resolve('/panel')} class="font-semibold">{m.app_name()}</a>
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
