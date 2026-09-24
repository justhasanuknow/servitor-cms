import type { MediaKind } from '../../constants/media';

export interface MediaItemView {
	id: string;
	width: number;
	height: number;
	animated: boolean;
	byteSize: number;
	createdAt: Date;
	altTexts: Record<string, string>;
	inUse: boolean;
}

export interface MediaPage {
	items: MediaItemView[];
	page: number;
	pageCount: number;
	total: number;
}

export interface MediaAltTextInput {
	languageCode: string;
	altText: string;
}

export interface MediaRecord {
	id: string;
	ownerId: string;
	kind: MediaKind;
	width: number;
	height: number;
}

export type MediaUploadResult =
	| { status: 'uploaded'; id: string }
	| { status: 'empty' }
	| { status: 'too_large' }
	| { status: 'unsupported_type' }
	| { status: 'invalid_image' }
	| { status: 'too_many_pixels' }
	| { status: 'rate_limited' };

export type MediaDeleteResult = 'deleted' | 'not_found' | 'in_use';

export type MediaAltTextResult = 'saved' | 'not_found' | 'unknown_language';
