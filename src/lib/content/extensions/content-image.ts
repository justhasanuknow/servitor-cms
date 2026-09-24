import { mergeAttributes, Node } from '@tiptap/core';
import { MAX_MEDIA_ALT_TEXT_LENGTH } from '../../constants/media';
import { parseMediaUrl } from '../media-urls';

const MAX_IMAGE_DIMENSION = 100_000;

const DIMENSION_PATTERN = /^[1-9][0-9]{0,5}$/;

export const ContentImage = Node.create({
	name: 'image',
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return {
			src: {
				default: null,
				parseHTML: (element: HTMLElement) => mediaSource(element.getAttribute('src'))
			},
			alt: {
				default: '',
				parseHTML: (element: HTMLElement) =>
					(element.getAttribute('alt') ?? '').slice(0, MAX_MEDIA_ALT_TEXT_LENGTH)
			},
			width: {
				default: null,
				parseHTML: (element: HTMLElement) => imageDimension(element.getAttribute('width'))
			},
			height: {
				default: null,
				parseHTML: (element: HTMLElement) => imageDimension(element.getAttribute('height'))
			}
		};
	},
	parseHTML() {
		return [
			{
				tag: 'img[src]',
				getAttrs: (element: HTMLElement) => {
					if (mediaSource(element.getAttribute('src')) === null) {
						return false;
					}

					return null;
				}
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return ['img', mergeAttributes(HTMLAttributes, { loading: 'lazy', decoding: 'async' })];
	}
});

export function imageDimension(value: string | null): number | null {
	if (value === null || !DIMENSION_PATTERN.test(value)) {
		return null;
	}

	const dimension = Number(value);

	if (dimension > MAX_IMAGE_DIMENSION) {
		return null;
	}

	return dimension;
}

function mediaSource(value: string | null): string | null {
	if (value === null || parseMediaUrl(value) === null) {
		return null;
	}

	return value;
}
