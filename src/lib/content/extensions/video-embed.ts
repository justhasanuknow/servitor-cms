import { Node } from '@tiptap/core';
import type { VideoEmbedReference } from '../../modules/interfaces/content.interfaces';
import {
	parseVideoEmbedUrl,
	parseVideoUrl,
	VIDEO_EMBED_ALLOW,
	VIDEO_EMBED_REFERRER_POLICY,
	VIDEO_EMBED_SANDBOX,
	VIDEO_PROVIDER_NAMES,
	videoEmbedUrl,
	videoReference
} from '../video-embeds';

export const VIDEO_EMBED_NODE = 'videoEmbed';

export const VideoEmbed = Node.create({
	name: VIDEO_EMBED_NODE,
	group: 'block',
	atom: true,
	draggable: true,
	selectable: true,
	addAttributes() {
		return {
			provider: {
				default: null,
				rendered: false,
				parseHTML: (element: HTMLElement) => embedFromElement(element)?.provider ?? null
			},
			videoId: {
				default: null,
				rendered: false,
				parseHTML: (element: HTMLElement) => embedFromElement(element)?.videoId ?? null
			}
		};
	},
	parseHTML() {
		return [
			{
				tag: 'div[data-type="video-embed"]',
				getAttrs: (element: HTMLElement) => embedAttributes(element)
			},
			{
				tag: 'iframe[src]',
				getAttrs: (element: HTMLElement) => embedAttributes(element)
			}
		];
	},
	renderHTML({ node }) {
		const reference = videoReference(node.attrs.provider, node.attrs.videoId);

		if (reference === null) {
			return ['div', { 'data-type': 'video-embed' }];
		}

		return [
			'div',
			{
				'data-type': 'video-embed',
				'data-provider': reference.provider,
				'data-video-id': reference.videoId
			},
			[
				'iframe',
				{
					src: videoEmbedUrl(reference),
					title: VIDEO_PROVIDER_NAMES[reference.provider],
					loading: 'lazy',
					referrerpolicy: VIDEO_EMBED_REFERRER_POLICY,
					sandbox: VIDEO_EMBED_SANDBOX,
					allow: VIDEO_EMBED_ALLOW
				}
			]
		];
	}
});

function embedAttributes(element: HTMLElement): Record<string, string> | false {
	const reference = embedFromElement(element);

	if (reference === null) {
		return false;
	}

	return { provider: reference.provider, videoId: reference.videoId };
}

function embedFromElement(element: HTMLElement): VideoEmbedReference | null {
	if (element.tagName.toLowerCase() === 'iframe') {
		return embedFromSource(element.getAttribute('src'));
	}

	const declared = videoReference(
		element.getAttribute('data-provider'),
		element.getAttribute('data-video-id')
	);

	if (declared !== null) {
		return declared;
	}

	const frame = element.querySelector('iframe');

	if (frame === null) {
		return null;
	}

	return embedFromSource(frame.getAttribute('src'));
}

function embedFromSource(src: string | null): VideoEmbedReference | null {
	if (src === null) {
		return null;
	}

	return parseVideoEmbedUrl(src) ?? parseVideoUrl(src);
}
