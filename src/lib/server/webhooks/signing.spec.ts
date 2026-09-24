import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-box';
import { generateWebhookSecret, signatureHeader, verifySignature } from './signing';

const SECRET = 'whsec_test-secret';

const BODY = '{"event":"post.published"}';

describe('webhook signatures', () => {
	it('signs "<timestamp>.<body>" with HMAC-SHA256', () => {
		const expected = createHmac('sha256', SECRET).update(`1790000000.${BODY}`).digest('hex');

		expect(signatureHeader(SECRET, BODY, 1_790_000_000)).toBe(`t=1790000000,v1=${expected}`);
	});

	it('verifies fresh signatures and rejects stale or altered ones', () => {
		const header = signatureHeader(SECRET, BODY, 1_790_000_000);

		expect(verifySignature(SECRET, BODY, header, 1_790_000_100)).toBe(true);
		expect(verifySignature(SECRET, BODY, header, 1_790_000_301)).toBe(false);
		expect(verifySignature(SECRET, `${BODY} `, header, 1_790_000_000)).toBe(false);
		expect(verifySignature('whsec_other', BODY, header, 1_790_000_000)).toBe(false);
		expect(verifySignature(SECRET, BODY, 'v1=abc', 1_790_000_000)).toBe(false);
	});

	it('generates random secrets with a prefix', () => {
		expect(generateWebhookSecret()).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
		expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
	});
});

describe('secret encryption', () => {
	const KEYS = { current: 'a-master-secret-that-is-long-enough-for-tests', previous: [] };

	it('round-trips secrets and never stores them in clear text', () => {
		const sealed = encryptSecret(SECRET, KEYS);

		expect(sealed).toMatch(/^v2\./);
		expect(sealed).not.toContain('test-secret');
		expect(encryptSecret(SECRET, KEYS)).not.toBe(sealed);
		expect(decryptSecret(sealed, KEYS)).toBe(SECRET);
	});

	it('fails closed for a different key or tampered data', () => {
		const sealed = encryptSecret(SECRET, KEYS);
		const [format, version, iv, tag, data] = sealed.split('.');
		const tampered = [format, version, iv, tag, `${data.slice(0, -2)}AA`].join('.');

		expect(decryptSecret(sealed, { current: `${KEYS.current}!`, previous: [] })).toBeNull();
		expect(decryptSecret(tampered, KEYS)).toBeNull();
		expect(decryptSecret('not-sealed', KEYS)).toBeNull();
	});
});
