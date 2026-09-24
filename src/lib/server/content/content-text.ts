import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { CJK_CHARACTERS_PER_MINUTE, WORDS_PER_MINUTE } from '../../constants/content';
import { parseMediaUrl } from '../../content/media-urls';

const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;

const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

const BLOCK_SEPARATOR = '\n\n';

export function documentText(document: ProseMirrorNode): string {
	return document
		.textBetween(0, document.content.size, BLOCK_SEPARATOR, leafText)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, BLOCK_SEPARATOR)
		.trim();
}

export function readingTimeMinutes(text: string): number {
	const cjkCharacters = countMatches(text, CJK_CHARACTER);
	const words = countMatches(text.replace(CJK_CHARACTER, ' '), WORD);

	if (cjkCharacters === 0 && words === 0) {
		return 0;
	}

	const minutes = words / WORDS_PER_MINUTE + cjkCharacters / CJK_CHARACTERS_PER_MINUTE;

	return Math.max(1, Math.ceil(minutes));
}

export function referencedMediaIds(document: ProseMirrorNode): string[] {
	const ids = new Set<string>();

	document.descendants((node) => {
		if (node.type.name === 'image' && typeof node.attrs.src === 'string') {
			const reference = parseMediaUrl(node.attrs.src);

			if (reference !== null) {
				ids.add(reference.id);
			}
		}
	});

	return [...ids];
}

function leafText(node: ProseMirrorNode): string {
	if (node.type.name === 'hardBreak') {
		return '\n';
	}

	return ' ';
}

function countMatches(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}
