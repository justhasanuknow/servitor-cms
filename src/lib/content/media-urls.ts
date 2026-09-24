import {
	MEDIA_ROUTE_PREFIX,
	MEDIA_VARIANT_WIDTHS,
	MEDIA_VARIANTS,
	type MediaVariant
} from '../constants/media';
import type { MediaDimensions, MediaReference } from '../modules/interfaces/content.interfaces';

const RESPONSIVE_VARIANTS: readonly MediaVariant[] = ['480', '960', '1600'];

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

export function mediaSrcset(id: string, width: number): string {
	const candidates = new Map<number, MediaVariant>();

	for (const variant of RESPONSIVE_VARIANTS) {
		const actual = Math.min(MEDIA_VARIANT_WIDTHS[variant], width);

		if (!candidates.has(actual)) {
			candidates.set(actual, variant);
		}
	}

	return [...candidates]
		.map(([candidateWidth, variant]) => `${mediaUrl(id, variant)} ${candidateWidth}w`)
		.join(', ');
}

export function variantDimensions(
	width: number,
	height: number,
	variant: MediaVariant
): MediaDimensions {
	const scale = Math.min(1, MEDIA_VARIANT_WIDTHS[variant] / width);

	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

export function parseMediaUrl(src: string): MediaReference | null {
	const match = MEDIA_URL_PATTERN.exec(src);

	if (match === null || !isMediaVariant(match[2])) {
		return null;
	}

	return { id: match[1], variant: match[2] };
}
