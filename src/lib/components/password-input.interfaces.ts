import type { HTMLInputAttributes } from 'svelte/elements';

export interface PasswordInputProps extends Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> {
	value?: string;
	toggleLabel?: string;
}
