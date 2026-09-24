import { MEDIA_ROUTE_PREFIX, MEDIA_VARIANTS, type MediaVariant } from '../constants/media';
import type { MediaReference } from '../modules/interfaces/content.interfaces';

export const MEDIA_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MEDIA_URL_PATTERN =
	/^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(480|960|1600|full)\.webp$/;

export function isMediaId(value: string): boolean {
	return MEDIA_ID_PATTERN.test(value);
}

export function isMediaVariant(value: string): value is MediaVariant {
	return MEDIA_VARIANTS.some((variant) => variant === value);
}

export function mediaUrl(id: string, variant: MediaVariant): string {
	return `${MEDIA_ROUTE_PREFIX}/${id}/${variant}.webp`;
}

export function parseMediaUrl(src: string): MediaReference | null {
	const match = MEDIA_URL_PATTERN.exec(src);

	if (match === null || !isMediaVariant(match[2])) {
		return null;
	}

	return { id: match[1], variant: match[2] };
}
