import type { TranslationStatus } from '$lib/constants/content';

export interface TranslationStatusBadgeProps {
	status: TranslationStatus;
	pendingChanges?: boolean;
}
