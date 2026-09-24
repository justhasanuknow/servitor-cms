<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import type { BackupCodesProps } from './backup-codes.interfaces';

	let { codes }: BackupCodesProps = $props();
</script>

<section class="grid gap-3 rounded-2xl border bg-muted/40 p-4">
	<h2 class="font-medium">{m.two_factor_backup_codes_title()}</h2>
	<p class="text-sm text-muted-foreground">{m.two_factor_backup_codes_save()}</p>
	<ol class="grid gap-2 font-mono text-sm sm:grid-cols-2" data-testid="backup-codes">
		{#each codes as code (code)}
			<li class="rounded-xl bg-background px-3 py-1.5">{code}</li>
		{/each}
	</ol>
</section>
