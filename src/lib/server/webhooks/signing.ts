import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import {
	WEBHOOK_SECRET_BYTES,
	WEBHOOK_SECRET_PREFIX,
	WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
} from '../../constants/webhooks';

const SIGNATURE_PATTERN = /^t=(\d+),v1=([0-9a-f]{64})$/;

export function generateWebhookSecret(): string {
	return `${WEBHOOK_SECRET_PREFIX}${randomBytes(WEBHOOK_SECRET_BYTES).toString('base64url')}`;
}

function digest(secret: string, timestamp: number, body: string): string {
	return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function signatureHeader(secret: string, body: string, timestamp: number): string {
	return `t=${timestamp},v1=${digest(secret, timestamp, body)}`;
}

export function verifySignature(
	secret: string,
	body: string,
	header: string,
	nowSeconds: number,
	toleranceSeconds: number = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
): boolean {
	const match = SIGNATURE_PATTERN.exec(header);

	if (match === null) {
		return false;
	}

	const timestamp = Number(match[1]);

	if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
		return false;
	}

	const expected = Buffer.from(digest(secret, timestamp, body), 'hex');
	const received = Buffer.from(match[2], 'hex');

	return expected.length === received.length && timingSafeEqual(expected, received);
}
