import type { QrCodeShape } from '$lib/modules/interfaces/qr-code.interfaces';

export interface QrCodeProps {
	shape: QrCodeShape;
	label: string;
}
