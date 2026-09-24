export interface SecretKeys {
	current: string;
	previous: string[];
}

export interface VersionedSecret {
	version: number;
	value: string;
}
