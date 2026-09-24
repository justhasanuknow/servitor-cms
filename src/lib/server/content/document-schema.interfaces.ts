import type { JSONContent } from '@tiptap/core';

export interface PendingDocumentNode {
	raw: unknown;
	depth: number;
	siblings: JSONContent[];
}

export type DocumentValidationResult =
	{ status: 'valid'; document: JSONContent } | { status: 'invalid' } | { status: 'too_large' };
