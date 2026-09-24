import type { VideoProvider } from '../../constants/content';
import type { MediaVariant } from '../../constants/media';

export interface VideoEmbedReference {
	provider: VideoProvider;
	videoId: string;
}

export interface MediaDimensions {
	width: number;
	height: number;
}

export interface MediaReference {
	id: string;
	variant: MediaVariant;
}
