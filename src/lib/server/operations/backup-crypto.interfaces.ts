export interface EncryptionHeader {
	kdf: 'scrypt';
	n: number;
	r: number;
	p: number;
	salt: string;
	nonce: string;
	chunk: number;
}

export interface EncryptionHeaderRead {
	header: EncryptionHeader;
	length: number;
}

export type DecryptionResult = 'decrypted' | 'wrong_passphrase' | 'invalid';
