export type AddressClass = 'public' | 'private' | 'blocked';

export interface AddressRange {
	base: bigint;
	prefix: number;
	bits: number;
	kind: AddressClass;
}
