import { describe, expect, it } from 'vitest';
import { parseVideoEmbedUrl, parseVideoUrl, videoEmbedUrl, videoReference } from './video-embeds';

describe('parseVideoUrl', () => {
	it.each([
		['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
		['https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
		['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
		['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
		['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
		['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
		['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ']
	])('reads the YouTube id from %s', (url, videoId) => {
		expect(parseVideoUrl(url)).toEqual({ provider: 'youtube', videoId });
	});

	it.each([
		['https://vimeo.com/76979871', '76979871'],
		['https://vimeo.com/channels/staffpicks/76979871', '76979871'],
		['https://player.vimeo.com/video/76979871', '76979871'],
		['https://vimeo.com/76979871/abcdef1234', '76979871']
	])('reads the Vimeo id from %s', (url, videoId) => {
		expect(parseVideoUrl(url)).toEqual({ provider: 'vimeo', videoId });
	});

	it.each([
		'https://example.com/watch?v=dQw4w9WgXcQ',
		'https://www.youtube.com/watch?v=short',
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ"onload="alert(1)',
		'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
		'javascript:alert(1)',
		'https://vimeo.com/channels/staffpicks',
		'not a url'
	])('rejects %j', (url) => {
		expect(parseVideoUrl(url)).toBeNull();
	});
});

describe('embed URLs', () => {
	it('builds privacy-friendly embed URLs', () => {
		expect(videoEmbedUrl({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' })).toBe(
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
		);
		expect(videoEmbedUrl({ provider: 'vimeo', videoId: '76979871' })).toBe(
			'https://player.vimeo.com/video/76979871?dnt=1'
		);
	});

	it('only accepts the exact embed URL forms', () => {
		expect(parseVideoEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toEqual({
			provider: 'youtube',
			videoId: 'dQw4w9WgXcQ'
		});
		expect(parseVideoEmbedUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBeNull();
		expect(
			parseVideoEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')
		).toBeNull();
		expect(parseVideoEmbedUrl('https://player.vimeo.com/video/76979871')).toBeNull();
	});

	it('validates stored references', () => {
		expect(videoReference('youtube', 'dQw4w9WgXcQ')).not.toBeNull();
		expect(videoReference('vimeo', '0123')).toBeNull();
		expect(videoReference('dailymotion', 'x7tgad0')).toBeNull();
		expect(videoReference('youtube', 42)).toBeNull();
	});
});
