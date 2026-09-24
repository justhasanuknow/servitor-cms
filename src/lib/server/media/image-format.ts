import type { MediaSourceFormat } from '../../constants/media';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const GIF_SIGNATURES = ['GIF87a', 'GIF89a'];

const AVIF_BRANDS = new Set(['avif', 'avis']);

const FTYP_HEADER_LENGTH = 16;

export function detectImageFormat(bytes: Uint8Array): MediaSourceFormat | null {
	if (startsWith(bytes, JPEG_SIGNATURE)) {
		return 'jpeg';
	}

	if (startsWith(bytes, PNG_SIGNATURE)) {
		return 'png';
	}

	if (GIF_SIGNATURES.includes(ascii(bytes, 0, 6))) {
		return 'gif';
	}

	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
		return 'webp';
	}

	if (isAvif(bytes)) {
		return 'avif';
	}

	return null;
}

function isAvif(bytes: Uint8Array): boolean {
	if (bytes.length < FTYP_HEADER_LENGTH || ascii(bytes, 4, 8) !== 'ftyp') {
		return false;
	}

	const boxSize = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);

	if (boxSize < FTYP_HEADER_LENGTH || boxSize > bytes.length) {
		return false;
	}

	if (AVIF_BRANDS.has(ascii(bytes, 8, 12))) {
		return true;
	}

	for (let offset = FTYP_HEADER_LENGTH; offset + 4 <= boxSize; offset += 4) {
		if (AVIF_BRANDS.has(ascii(bytes, offset, offset + 4))) {
			return true;
		}
	}

	return false;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
	return (
		bytes.length >= signature.length &&
		signature.every((value, index) => bytes[index] === value)
	);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
	if (bytes.length < end) {
		return '';
	}

	return String.fromCharCode(...bytes.subarray(start, end));
}
