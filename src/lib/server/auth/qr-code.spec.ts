import { describe, expect, it } from 'vitest';
import { qrCodeShape } from './qr-code';

describe('qrCodeShape', () => {
	it('draws square modules inside a four-module quiet zone', () => {
		const shape = qrCodeShape(
			'otpauth://totp/Servitor:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Servitor'
		);
		const coordinates = [...shape.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((match) => [
			Number(match[1]),
			Number(match[2])
		]);

		expect(shape.size).toBeGreaterThanOrEqual(29);
		expect(shape.path).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
		expect(coordinates.length).toBeGreaterThan(0);

		for (const [x, y] of coordinates) {
			expect(x).toBeGreaterThanOrEqual(4);
			expect(y).toBeGreaterThanOrEqual(4);
			expect(x).toBeLessThan(shape.size - 4);
			expect(y).toBeLessThan(shape.size - 4);
		}
	});
});
