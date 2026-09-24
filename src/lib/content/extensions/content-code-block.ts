import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { isCodeLanguage, lowlight } from '../code-languages';

const LANGUAGE_CLASS_PREFIX = 'language-';

const HIGHLIGHT_CLASS_PATTERN = /^(?:hljs-[a-z0-9_-]+|[a-z]+_+)$/;

type HighlightTree = ReturnType<typeof lowlight.highlight>;

type HighlightNode = HighlightTree['children'][number];

type CodeOutputChild = string | CodeOutputSpec;

type CodeOutputSpec = [string, Record<string, string>, ...CodeOutputChild[]];

export const ContentCodeBlock = CodeBlockLowlight.extend({
	addAttributes() {
		return {
			language: {
				default: null,
				rendered: false,
				parseHTML: (element: HTMLElement) => languageFromElement(element)
			}
		};
	},
	renderHTML({ node }) {
		const language = codeLanguage(node.attrs.language);
		const code: CodeOutputSpec = [
			'code',
			languageAttributes(language),
			...highlightedCode(node.textContent, language)
		];

		return ['pre', {}, code];
	}
}).configure({
	lowlight,
	languageClassPrefix: LANGUAGE_CLASS_PREFIX,
	defaultLanguage: null
});

export function codeLanguage(value: unknown): string | null {
	if (typeof value !== 'string' || !isCodeLanguage(value)) {
		return null;
	}

	return value;
}

function languageFromElement(element: HTMLElement): string | null {
	const candidates = [element, ...Array.from(element.children)];

	for (const candidate of candidates) {
		for (const className of Array.from(candidate.classList)) {
			if (className.startsWith(LANGUAGE_CLASS_PREFIX)) {
				return codeLanguage(className.slice(LANGUAGE_CLASS_PREFIX.length));
			}
		}
	}

	return null;
}

function languageAttributes(language: string | null): Record<string, string> {
	if (language === null) {
		return {};
	}

	return { class: `${LANGUAGE_CLASS_PREFIX}${language}` };
}

function highlightedCode(text: string, language: string | null): CodeOutputChild[] {
	if (text === '') {
		return [];
	}

	let tree: HighlightTree;

	if (language === null) {
		tree = lowlight.highlightAuto(text);
	} else {
		tree = lowlight.highlight(language, text);
	}

	return tree.children.flatMap(outputSpec);
}

function outputSpec(node: HighlightNode): CodeOutputChild[] {
	if (node.type === 'text') {
		return [node.value];
	}

	if (node.type !== 'element') {
		return [];
	}

	const children = node.children.flatMap(outputSpec);
	const classNames = highlightClasses(node.properties.className);

	if (classNames.length === 0) {
		return children;
	}

	const span: CodeOutputSpec = ['span', { class: classNames.join(' ') }, ...children];

	return [span];
}

function highlightClasses(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter(
		(className): className is string =>
			typeof className === 'string' && HIGHLIGHT_CLASS_PATTERN.test(className)
	);
}
