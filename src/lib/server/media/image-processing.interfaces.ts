import type { MediaVariant } from '../../constants/media';

export interface ImageProcessingOptions {
	square: boolean;
}

export interface ProcessedVariant {
	variant: MediaVariant;
	data: Buffer;
	width: number;
	height: number;
}

export interface ProcessedImage {
	animated: boolean;
	width: number;
	height: number;
	byteSize: number;
	variants: ProcessedVariant[];
}

export type ImageProcessingResult =
	| { status: 'processed'; image: ProcessedImage }
	| { status: 'invalid_image' }
	| { status: 'too_many_pixels' };
