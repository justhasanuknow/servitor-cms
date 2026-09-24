import { describe, expect, it, vi } from 'vitest';
import { classifyAddress } from './ip-ranges';
import { resolveWebhookTarget } from './safe-target';
import type { ResolvedAddress, Resolver } from './safe-target.interfaces';

function resolverFor(...addresses: string[]): Resolver {
	return vi.fn(async () =>
		addresses.map((address): ResolvedAddress => {
			if (address.includes(':')) {
				return { address, family: 6 };
			}

			return { address, family: 4 };
		})
	);
}

function target(url: string, resolve: Resolver, allowPrivate = false) {
	return resolveWebhookTarget(new URL(url), { allowPrivate, resolve });
}

describe('address classification', () => {
	it.each([
		'10.0.0.1',
		'10.255.255.255',
		'172.16.0.1',
		'172.31.255.254',
		'192.168.1.10',
		'100.64.0.1',
		'100.127.255.255',
		'fc00::1',
		'fd12:3456:789a::1'
	])('treats %s as private', (address) => {
		expect(classifyAddress(address)).toBe('private');
	});

	it.each([
		'127.0.0.1',
		'127.255.255.254',
		'0.0.0.0',
		'169.254.169.254',
		'169.254.0.1',
		'224.0.0.1',
		'239.255.255.250',
		'240.0.0.1',
		'255.255.255.255',
		'192.0.2.1',
		'198.51.100.7',
		'203.0.113.9',
		'198.18.0.1',
		'::',
		'::1',
		'fe80::1',
		'fe80::1%eth0',
		'ff02::1',
		'2001:db8::1',
		'2001::1',
		'2002:7f00:1::1',
		'::ffff:127.0.0.1',
		'::ffff:7f00:1',
		'::ffff:169.254.169.254',
		'64:ff9b::a9fe:a9fe',
		'::127.0.0.1',
		'fec0::1'
	])('blocks %s', (address) => {
		expect(classifyAddress(address)).toBe('blocked');
	});

	it.each(['93.184.216.34', '8.8.8.8', '172.32.0.1', '100.128.0.1', '2606:4700::1111'])(
		'allows the public address %s',
		(address) => {
			expect(classifyAddress(address)).toBe('public');
		}
	);

	it('classifies IPv4 addresses embedded in IPv6', () => {
		expect(classifyAddress('::ffff:10.0.0.1')).toBe('private');
		expect(classifyAddress('::ffff:93.184.216.34')).toBe('public');
		expect(classifyAddress('64:ff9b::5db8:d822')).toBe('public');
	});
});

describe('webhook targets', () => {
	it('resolves the host once and pins the vetted address', async () => {
		const resolve = resolverFor('93.184.216.34');

		expect(await target('https://hooks.example.com/build', resolve)).toEqual({
			status: 'ok',
			address: '93.184.216.34',
			family: 4
		});
		expect(resolve).toHaveBeenCalledTimes(1);
		expect(resolve).toHaveBeenCalledWith('hooks.example.com');
	});

	it('rejects hosts that resolve to loopback, link-local or metadata addresses', async () => {
		for (const address of [
			'127.0.0.1',
			'::1',
			'169.254.169.254',
			'fe80::1',
			'::ffff:127.0.0.1'
		]) {
			expect(await target('https://hooks.example.com', resolverFor(address), true)).toEqual({
				status: 'rejected',
				reason: 'blocked_address'
			});
		}
	});

	it('rejects a host when any of its addresses is blocked', async () => {
		expect(
			await target('https://hooks.example.com', resolverFor('93.184.216.34', '127.0.0.1'))
		).toEqual({ status: 'rejected', reason: 'blocked_address' });
	});

	it('rejects private addresses unless WEBHOOK_ALLOW_PRIVATE is set', async () => {
		expect(await target('https://build.internal', resolverFor('10.1.2.3'))).toEqual({
			status: 'rejected',
			reason: 'private_address'
		});
		expect(await target('https://build.internal', resolverFor('10.1.2.3'), true)).toEqual({
			status: 'ok',
			address: '10.1.2.3',
			family: 4
		});
		expect(await target('https://build.internal', resolverFor('fd00::7'), true)).toMatchObject({
			status: 'ok',
			family: 6
		});
	});

	it('allows plain http only to private addresses with WEBHOOK_ALLOW_PRIVATE', async () => {
		expect(await target('http://build.internal', resolverFor('192.168.1.5'))).toEqual({
			status: 'rejected',
			reason: 'private_address'
		});
		expect(
			await target('http://build.internal', resolverFor('192.168.1.5'), true)
		).toMatchObject({
			status: 'ok'
		});
		expect(
			await target('http://hooks.example.com', resolverFor('93.184.216.34'), true)
		).toEqual({
			status: 'rejected',
			reason: 'insecure_scheme'
		});
		expect(await target('http://hooks.example.com', resolverFor('93.184.216.34'))).toEqual({
			status: 'rejected',
			reason: 'insecure_scheme'
		});
	});

	it('checks IP literals without resolving them', async () => {
		const resolve = resolverFor('93.184.216.34');

		expect(await target('https://169.254.169.254/latest/meta-data', resolve)).toEqual({
			status: 'rejected',
			reason: 'blocked_address'
		});
		expect(await target('https://[::1]:8443/', resolve)).toEqual({
			status: 'rejected',
			reason: 'blocked_address'
		});
		expect(await target('https://[2606:4700::1111]/', resolve)).toMatchObject({ status: 'ok' });
		expect(resolve).not.toHaveBeenCalled();
	});

	it('rejects other schemes, credentials and unresolvable hosts', async () => {
		expect(await target('ftp://hooks.example.com', resolverFor('93.184.216.34'))).toEqual({
			status: 'rejected',
			reason: 'unsupported_scheme'
		});
		expect(
			await target('https://user:pass@hooks.example.com', resolverFor('93.184.216.34'))
		).toEqual({ status: 'rejected', reason: 'credentials_in_url' });
		expect(
			await target('https://missing.example.com', async () => {
				throw new Error('ENOTFOUND');
			})
		).toEqual({ status: 'rejected', reason: 'dns_failed' });
		expect(await target('https://empty.example.com', resolverFor())).toEqual({
			status: 'rejected',
			reason: 'dns_failed'
		});
	});

	it('is not fooled by DNS rebinding because only the first answer is used', async () => {
		const answers = [['93.184.216.34'], ['127.0.0.1']];
		const resolve: Resolver = vi.fn(async () =>
			(answers.shift() ?? []).map((address): ResolvedAddress => ({ address, family: 4 }))
		);

		expect(await target('https://rebind.example.com', resolve)).toMatchObject({
			address: '93.184.216.34'
		});
		expect(resolve).toHaveBeenCalledTimes(1);
	});
});
