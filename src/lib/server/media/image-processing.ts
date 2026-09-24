import sharp, { type Metadata, type Sharp } from 'sharp';
import {
	MAX_MEDIA_INPUT_PIXELS,
	MEDIA_VARIANT_WIDTHS,
	MEDIA_VARIANTS,
	type MediaSourceFormat,
	type MediaVariant
} from '../../constants/media';
import type {
	ImageProcessingOptions,
	ImageProcessingResult,
	ProcessedVariant
} from './image-processing.interfaces';

const WEBP_QUALITY = 82;

const WEBP_EFFORT = 4;

const PIXEL_LIMIT_MESSAGE = 'exceeds pixel limit';

const SHARP_FORMATS: Record<MediaSourceFormat, string> = {
	jpeg: 'jpeg',
	png: 'png',
	gif: 'gif',
	webp: 'webp',
	avif: 'heif'
};

export async function processImage(
	input: Buffer,
	format: MediaSourceFormat,
	options: ImageProcessingOptions
): Promise<ImageProcessingResult> {
	try {
		const metadata = await sharp(input, {
			limitInputPixels: MAX_MEDIA_INPUT_PIXELS
		}).metadata();

		if (!matchesFormat(metadata, format)) {
			return { status: 'invalid_image' };
		}

		const animated = (format === 'gif' || format === 'webp') && (metadata.pages ?? 1) > 1;
		const source = sharp(input, { limitInputPixels: MAX_MEDIA_INPUT_PIXELS, animated });
		const shortestSide = Math.min(metadata.width, metadata.pageHeight ?? metadata.height);
		const variants: ProcessedVariant[] = [];

		for (const variant of MEDIA_VARIANTS) {
			variants.push(await renderVariant(source, variant, options.square, shortestSide));
		}

		const full = variants[variants.length - 1];

		return {
			status: 'processed',
			image: {
				animated,
				width: full.width,
				height: full.height,
				byteSize: full.data.byteLength,
				variants
			}
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes(PIXEL_LIMIT_MESSAGE)) {
			return { status: 'too_many_pixels' };
		}

		return { status: 'invalid_image' };
	}
}

async function renderVariant(
	source: Sharp,
	variant: MediaVariant,
	square: boolean,
	shortestSide: number
): Promise<ProcessedVariant> {
	const width = MEDIA_VARIANT_WIDTHS[variant];
	const pipeline = source.clone().autoOrient();

	if (square) {
		const side = Math.min(width, shortestSide);

		pipeline.resize({ width: side, height: side, fit: 'cover', position: 'centre' });
	} else {
		pipeline.resize({ width, withoutEnlargement: true });
	}

	const { data, info } = await pipeline
		.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
		.toBuffer({ resolveWithObject: true });

	return { variant, data, width: info.width, height: info.pageHeight ?? info.height };
}

function matchesFormat(metadata: Metadata, format: MediaSourceFormat): boolean {
	if (metadata.format !== SHARP_FORMATS[format]) {
		return false;
	}

	if (format === 'avif') {
		return metadata.compression === 'av1';
	}

	return true;
}
