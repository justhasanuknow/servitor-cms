import { VIDEO_PROVIDERS, type VideoProvider } from '../constants/content';
import type { VideoEmbedReference } from '../modules/interfaces/content.interfaces';

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const VIMEO_VIDEO_ID = /^[1-9][0-9]{0,11}$/;

const YOUTUBE_EMBED_URL = /^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})$/;

const VIMEO_EMBED_URL = /^https:\/\/player\.vimeo\.com\/video\/([1-9][0-9]{0,11})\?dnt=1$/;

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);

const YOUTUBE_SHORT_HOST = 'youtu.be';

const YOUTUBE_PATH_PREFIXES = new Set(['embed', 'shorts', 'live', 'v']);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

export const VIDEO_EMBED_HOSTNAMES: readonly string[] = [
	'www.youtube-nocookie.com',
	'player.vimeo.com'
];

export const VIDEO_EMBED_SANDBOX =
	'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

export const VIDEO_EMBED_ALLOW = 'encrypted-media; picture-in-picture; fullscreen';

export const VIDEO_EMBED_REFERRER_POLICY = 'strict-origin-when-cross-origin';

export const VIDEO_PROVIDER_NAMES: Record<VideoProvider, string> = {
	youtube: 'YouTube',
	vimeo: 'Vimeo'
};

export function isVideoProvider(value: string): value is VideoProvider {
	return VIDEO_PROVIDERS.some((provider) => provider === value);
}

export function isValidVideoId(provider: VideoProvider, videoId: string): boolean {
	if (provider === 'youtube') {
		return YOUTUBE_VIDEO_ID.test(videoId);
	}

	return VIMEO_VIDEO_ID.test(videoId);
}

export function videoReference(provider: unknown, videoId: unknown): VideoEmbedReference | null {
	if (typeof provider !== 'string' || typeof videoId !== 'string') {
		return null;
	}

	if (!isVideoProvider(provider) || !isValidVideoId(provider, videoId)) {
		return null;
	}

	return { provider, videoId };
}

export function videoEmbedUrl(reference: VideoEmbedReference): string {
	if (reference.provider === 'youtube') {
		return `https://www.youtube-nocookie.com/embed/${reference.videoId}`;
	}

	return `https://player.vimeo.com/video/${reference.videoId}?dnt=1`;
}

export function parseVideoEmbedUrl(src: string): VideoEmbedReference | null {
	const youtube = YOUTUBE_EMBED_URL.exec(src);

	if (youtube !== null) {
		return { provider: 'youtube', videoId: youtube[1] };
	}

	const vimeo = VIMEO_EMBED_URL.exec(src);

	if (vimeo !== null) {
		return { provider: 'vimeo', videoId: vimeo[1] };
	}

	return null;
}

export function parseVideoUrl(input: string): VideoEmbedReference | null {
	let url: URL;

	try {
		url = new URL(input.trim());
	} catch {
		return null;
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		return null;
	}

	const host = url.hostname.toLowerCase();
	const segments = url.pathname.split('/').filter((segment) => segment !== '');

	if (host === YOUTUBE_SHORT_HOST) {
		return videoReference('youtube', segments[0]);
	}

	if (YOUTUBE_HOSTS.has(host)) {
		return youtubeReference(url, segments);
	}

	if (VIMEO_HOSTS.has(host)) {
		return vimeoReference(segments);
	}

	return null;
}

function youtubeReference(url: URL, segments: string[]): VideoEmbedReference | null {
	if (segments.length === 1 && segments[0] === 'watch') {
		return videoReference('youtube', url.searchParams.get('v'));
	}

	if (segments.length >= 2 && YOUTUBE_PATH_PREFIXES.has(segments[0])) {
		return videoReference('youtube', segments[1]);
	}

	return null;
}

function vimeoReference(segments: string[]): VideoEmbedReference | null {
	for (let index = segments.length - 1; index >= 0; index -= 1) {
		if (VIMEO_VIDEO_ID.test(segments[index])) {
			return videoReference('vimeo', segments[index]);
		}
	}

	return null;
}
