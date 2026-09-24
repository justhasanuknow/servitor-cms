import { encode } from 'uqr';
import type { QrCodeShape } from '../../modules/interfaces/qr-code.interfaces';

const QUIET_ZONE_MODULES = 4;

export function qrCodeShape(text: string): QrCodeShape {
	const { data, size } = encode(text, { ecc: 'M', border: QUIET_ZONE_MODULES });
	const segments: string[] = [];

	data.forEach((row, y) => {
		row.forEach((dark, x) => {
			if (dark) {
				segments.push(`M${x} ${y}h1v1h-1z`);
			}
		});
	});

	return { size, path: segments.join('') };
}
