import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { classifyAddress } from './ip-ranges';
import type {
	ResolvedAddress,
	Resolver,
	TargetOptions,
	TargetResult
} from './safe-target.interfaces';

const IPV6_LITERAL = /^\[(.+)\]$/;

export const systemResolver: Resolver = async (hostname) => {
	const addresses = await lookup(hostname, { all: true, verbatim: true });

	return addresses.flatMap((entry): ResolvedAddress[] => {
		if (entry.family === 4 || entry.family === 6) {
			return [{ address: entry.address, family: entry.family }];
		}

		return [];
	});
};

function bareHostname(url: URL): string {
	return IPV6_LITERAL.exec(url.hostname)?.[1] ?? url.hostname;
}

async function addressesOf(hostname: string, resolve: Resolver): Promise<ResolvedAddress[] | null> {
	const family = isIP(hostname);

	if (family === 4 || family === 6) {
		return [{ address: hostname, family }];
	}

	try {
		return await resolve(hostname);
	} catch {
		return null;
	}
}

export async function resolveWebhookTarget(
	url: URL,
	options: TargetOptions
): Promise<TargetResult> {
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		return { status: 'rejected', reason: 'unsupported_scheme' };
	}

	if (url.username !== '' || url.password !== '') {
		return { status: 'rejected', reason: 'credentials_in_url' };
	}

	const addresses = await addressesOf(bareHostname(url), options.resolve);

	if (addresses === null || addresses.length === 0) {
		return { status: 'rejected', reason: 'dns_failed' };
	}

	const classes = addresses.map((entry) => classifyAddress(entry.address));

	if (classes.includes('blocked')) {
		return { status: 'rejected', reason: 'blocked_address' };
	}

	const allPrivate = classes.every((kind) => kind === 'private');

	if (classes.includes('private') && !options.allowPrivate) {
		return { status: 'rejected', reason: 'private_address' };
	}

	if (url.protocol === 'http:' && !(options.allowPrivate && allPrivate)) {
		return { status: 'rejected', reason: 'insecure_scheme' };
	}

	return { status: 'ok', address: addresses[0].address, family: addresses[0].family };
}
