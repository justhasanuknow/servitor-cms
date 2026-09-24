import { crc32 } from 'node:zlib';
import sharp from 'sharp';

const PNG_IHDR_OFFSET = 8;

const PNG_CHUNK_HEADER_LENGTH = 8;

const PNG_IHDR_DATA_LENGTH = 13;

export async function jpegWithExif(width = 1200, height = 800): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: '#3366cc' } })
		.jpeg()
		.withExif({ IFD0: { Copyright: 'Private photographer', ImageDescription: 'Home address' } })
		.toBuffer();
}

export async function pngImage(width: number, height: number): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 4, background: '#22aa66' } })
		.png()
		.toBuffer();
}

export async function webpImage(width: number, height: number): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: '#aa2266' } })
		.webp()
		.toBuffer();
}

export async function avifImage(width: number, height: number): Promise<Buffer> {
	return sharp({ create: { width, height, channels: 3, background: '#6622aa' } })
		.avif()
		.toBuffer();
}

export async function animatedGif(): Promise<Buffer> {
	const frames = await Promise.all(
		['#ff0000', '#00ff00', '#0000ff'].map((background) =>
			sharp({ create: { width: 64, height: 48, channels: 4, background } })
				.png()
				.toBuffer()
		)
	);

	return sharp(frames, { join: { animated: true } })
		.gif({ loop: 0, delay: [100, 100, 100] })
		.toBuffer();
}

export function withPngDimensions(png: Buffer, width: number, height: number): Buffer {
	const patched = Buffer.from(png);
	const dataStart = PNG_IHDR_OFFSET + PNG_CHUNK_HEADER_LENGTH;

	patched.writeUInt32BE(width, dataStart);
	patched.writeUInt32BE(height, dataStart + 4);

	const checksum = crc32(patched.subarray(PNG_IHDR_OFFSET + 4, dataStart + PNG_IHDR_DATA_LENGTH));

	patched.writeUInt32BE(checksum, dataStart + PNG_IHDR_DATA_LENGTH);

	return patched;
}

export function imageFile(data: Buffer, name: string, type: string): File {
	return new File([new Uint8Array(data)], name, { type });
}

export const SVG_IMAGE = Buffer.from(
	'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>'
);
