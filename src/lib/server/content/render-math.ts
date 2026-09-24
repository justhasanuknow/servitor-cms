import katex from 'katex';
import { katexOptions } from '../../content/math';
import type { MathSource } from './sanitize-content.interfaces';

const MATH_PLACEHOLDER =
	/<span data-type="inline-math" data-math-index="([0-9]{1,6})"><\/span>|<div data-type="block-math" data-math-index="([0-9]{1,6})"><\/div>/g;

const ATTRIBUTE_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'"': '&quot;',
	"'": '&#39;',
	'<': '&lt;',
	'>': '&gt;'
};

export function renderMathPlaceholders(html: string, math: MathSource[]): string {
	return html.replace(
		MATH_PLACEHOLDER,
		(placeholder: string, inlineIndex: string | undefined, blockIndex: string | undefined) => {
			if (inlineIndex !== undefined) {
				return renderMath('span', 'inline-math', math[Number(inlineIndex)], false);
			}

			if (blockIndex !== undefined) {
				return renderMath('div', 'block-math', math[Number(blockIndex)], true);
			}

			return '';
		}
	);
}

export function escapeHtml(value: string): string {
	return value.replace(/[&"'<>]/g, (character) => ATTRIBUTE_ESCAPES[character] ?? character);
}

function renderMath(
	tagName: string,
	type: string,
	source: MathSource | undefined,
	displayMode: boolean
): string {
	if (source === undefined || source.displayMode !== displayMode) {
		return '';
	}

	const latex = escapeHtml(source.latex);

	return `<${tagName} data-type="${type}" data-latex="${latex}">${renderLatex(source.latex, displayMode)}</${tagName}>`;
}

function renderLatex(latex: string, displayMode: boolean): string {
	try {
		return katex.renderToString(latex, katexOptions(displayMode));
	} catch {
		return `<code>${escapeHtml(latex)}</code>`;
	}
}
