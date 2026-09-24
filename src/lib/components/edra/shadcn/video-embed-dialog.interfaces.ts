import type { VideoEmbedReference } from '$lib/modules/interfaces/content.interfaces';

export interface VideoEmbedDialogProps {
	open: boolean;
	onInsert: (reference: VideoEmbedReference) => void;
}
