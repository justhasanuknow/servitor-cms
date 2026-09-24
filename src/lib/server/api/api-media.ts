import { and, inArray } from 'drizzle-orm';
import { mediaUrl, variantDimensions } from '../../content/media-urls';
import type { MediaVariant } from '../../constants/media';
import { absoluteUrl } from '../../public/paths';
import type { DatabaseExecutor } from '../db';
import { media, mediaAltTexts } from '../db/schema';
import type { ApiMedia, ApiMediaVariant } from './api.interfaces';

function variant(
	origin: string,
	id: string,
	width: number,
	height: number,
	name: MediaVariant
): ApiMediaVariant {
	return {
		url: absoluteUrl(origin, mediaUrl(id, name)),
		...variantDimensions(width, height, name)
	};
}

export function apiMediaMap(
	db: DatabaseExecutor,
	origin: string,
	ids: (string | null)[],
	languages: string[]
): Map<string, ApiMedia> {
	const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
	const result = new Map<string, ApiMedia>();

	if (wanted.length === 0) {
		return result;
	}

	const altTexts = new Map<string, Record<string, string>>();

	if (languages.length > 0) {
		for (const row of db
			.select()
			.from(mediaAltTexts)
			.where(
				and(
					inArray(mediaAltTexts.mediaId, wanted),
					inArray(mediaAltTexts.languageCode, languages)
				)
			)
			.all()) {
			altTexts.set(row.mediaId, {
				...altTexts.get(row.mediaId),
				[row.languageCode]: row.altText
			});
		}
	}

	for (const row of db
		.select({ id: media.id, width: media.width, height: media.height })
		.from(media)
		.where(inArray(media.id, wanted))
		.all()) {
		result.set(row.id, {
			id: row.id,
			width: row.width,
			height: row.height,
			alt: altTexts.get(row.id) ?? {},
			variants: {
				'480': variant(origin, row.id, row.width, row.height, '480'),
				'960': variant(origin, row.id, row.width, row.height, '960'),
				'1600': variant(origin, row.id, row.width, row.height, '1600'),
				full: variant(origin, row.id, row.width, row.height, 'full')
			}
		});
	}

	return result;
}

export function mediaFrom(map: Map<string, ApiMedia>, id: string | null): ApiMedia | null {
	if (id === null) {
		return null;
	}

	return map.get(id) ?? null;
}
