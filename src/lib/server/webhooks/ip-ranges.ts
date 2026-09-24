import { isIPv4, isIPv6 } from 'node:net';
import type { AddressClass, AddressRange } from './ip-ranges.interfaces';

const IPV4_BITS = 32;

const IPV6_BITS = 128;

const IPV4_RANGES: AddressRange[] = [
	range('0.0.0.0', 8, 'blocked'),
	range('10.0.0.0', 8, 'private'),
	range('100.64.0.0', 10, 'private'),
	range('127.0.0.0', 8, 'blocked'),
	range('169.254.0.0', 16, 'blocked'),
	range('172.16.0.0', 12, 'private'),
	range('192.0.0.0', 24, 'blocked'),
	range('192.0.2.0', 24, 'blocked'),
	range('192.88.99.0', 24, 'blocked'),
	range('192.168.0.0', 16, 'private'),
	range('198.18.0.0', 15, 'blocked'),
	range('198.51.100.0', 24, 'blocked'),
	range('203.0.113.0', 24, 'blocked'),
	range('224.0.0.0', 4, 'blocked'),
	range('240.0.0.0', 4, 'blocked')
];

const IPV6_RANGES: AddressRange[] = [
	range('::', 96, 'blocked'),
	range('64:ff9b:1::', 48, 'blocked'),
	range('100::', 64, 'blocked'),
	range('2001::', 23, 'blocked'),
	range('2001:db8::', 32, 'blocked'),
	range('2002::', 16, 'blocked'),
	range('fc00::', 7, 'private'),
	range('fe80::', 10, 'blocked'),
	range('fec0::', 10, 'blocked'),
	range('ff00::', 8, 'blocked')
];

const IPV6_GLOBAL_UNICAST = range('2000::', 3, 'blocked');

const IPV6_EMBEDDED_IPV4: AddressRange[] = [
	range('::ffff:0:0', 96, 'blocked'),
	range('64:ff9b::', 96, 'blocked')
];

function range(network: string, prefix: number, kind: AddressClass): AddressRange {
	let bits = IPV6_BITS;
	let base = ipv6Value(network);

	if (isIPv4(network)) {
		bits = IPV4_BITS;
		base = ipv4Value(network);
	}

	if (base === null) {
		throw new Error(`Invalid network ${network}`);
	}

	return { base, prefix, bits, kind };
}

function ipv4Value(address: string): bigint {
	return address.split('.').reduce((value, part) => (value << 8n) + BigInt(Number(part)), 0n);
}

function ipv6Value(address: string): bigint | null {
	let value = address.split('%')[0].toLowerCase();
	const lastColon = value.lastIndexOf(':');
	const tail = value.slice(lastColon + 1);

	if (tail.includes('.')) {
		if (!isIPv4(tail)) {
			return null;
		}

		const embedded = ipv4Value(tail);

		value = `${value.slice(0, lastColon + 1)}${(embedded >> 16n).toString(16)}:${(embedded & 0xffffn).toString(16)}`;
	}

	const [head, rest] = value.split('::');
	let parts = value.split(':');

	if (rest !== undefined) {
		const headParts = groups(head);
		const tailParts = groups(rest);

		parts = [
			...headParts,
			...Array.from({ length: 8 - headParts.length - tailParts.length }, () => '0'),
			...tailParts
		];
	}

	if (parts.length !== 8) {
		return null;
	}

	return parts.reduce((result, part) => (result << 16n) + BigInt(Number.parseInt(part, 16)), 0n);
}

function groups(text: string): string[] {
	if (text === '') {
		return [];
	}

	return text.split(':');
}

function contains(entry: AddressRange, value: bigint): boolean {
	const shift = BigInt(entry.bits - entry.prefix);

	return value >> shift === entry.base >> shift;
}

function classifyIpv4(value: bigint): AddressClass {
	return IPV4_RANGES.find((entry) => contains(entry, value))?.kind ?? 'public';
}

export function classifyAddress(address: string): AddressClass {
	if (isIPv4(address)) {
		return classifyIpv4(ipv4Value(address));
	}

	if (!isIPv6(address)) {
		return 'blocked';
	}

	const value = ipv6Value(address);

	if (value === null) {
		return 'blocked';
	}

	if (IPV6_EMBEDDED_IPV4.some((entry) => contains(entry, value))) {
		return classifyIpv4(value & 0xffffffffn);
	}

	const special = IPV6_RANGES.find((entry) => contains(entry, value));

	if (special !== undefined) {
		return special.kind;
	}

	if (contains(IPV6_GLOBAL_UNICAST, value)) {
		return 'public';
	}

	return 'blocked';
}
