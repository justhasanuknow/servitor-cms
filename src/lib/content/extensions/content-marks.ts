import { getStyleProperty } from '@tiptap/core';
import Highlight from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-text-style';
import { allowedColorOrNull } from '../colors';

export const ContentColor = Color.extend({
	addGlobalAttributes() {
		return [
			{
				types: this.options.types,
				attributes: {
					color: {
						default: null,
						parseHTML: (element: HTMLElement) =>
							allowedColorOrNull(
								getStyleProperty(element, 'color') ?? element.style.color
							),
						renderHTML: (attributes: Record<string, unknown>) =>
							colorStyle('color', attributes.color)
					}
				}
			}
		];
	}
});

export const ContentHighlight = Highlight.extend({
	addAttributes() {
		return {
			color: {
				default: null,
				parseHTML: (element: HTMLElement) =>
					allowedColorOrNull(
						element.getAttribute('data-color') ??
							getStyleProperty(element, 'background-color') ??
							element.style.backgroundColor
					),
				renderHTML: (attributes: Record<string, unknown>) =>
					colorStyle('background-color', attributes.color)
			}
		};
	}
}).configure({ multicolor: true });

function colorStyle(property: string, value: unknown): Record<string, string> {
	if (typeof value !== 'string') {
		return {};
	}

	const color = allowedColorOrNull(value);

	if (color === null) {
		return {};
	}

	return { style: `${property}: ${color}` };
}
