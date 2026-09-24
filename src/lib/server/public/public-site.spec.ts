import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentLanguages, systemSettings } from '../db/schema';
import { ensureDefaultContentLanguage } from '../languages/languages';
import { createLogger } from '../logging/logger';
import { createTestRuntime } from '../testing/runtime';
import { pageParam, publicLanguageParam, requirePublicSite, slugParam } from './public-site';

let harness: ReturnType<typeof createTestRuntime>;

beforeEach(() => {
	harness = createTestRuntime();
	ensureDefaultContentLanguage(harness.runtime.db, harness.runtime.env, createLogger('silent'));
});

afterEach(() => {
	harness.dispose();
});

const notFound = expect.objectContaining({ status: 404 });

describe('headless mode', () => {
	it('answers public routes with 404 when the public site is off', () => {
		expect(requirePublicSite(harness.runtime.db).publicSiteEnabled).toBe(true);

		harness.runtime.db
			.update(systemSettings)
			.set({ publicSiteEnabled: false })
			.where(eq(systemSettings.id, 1))
			.run();

		expect(() => requirePublicSite(harness.runtime.db)).toThrow(notFound);
	});
});

describe('route parameters', () => {
	it('accepts only enabled content languages', () => {
		harness.runtime.db
			.insert(contentLanguages)
			.values({ code: 'de', name: 'German', nativeName: 'Deutsch', enabled: false })
			.run();

		expect(publicLanguageParam(harness.runtime.db, 'en').code).toBe('en');
		expect(() => publicLanguageParam(harness.runtime.db, 'de')).toThrow(notFound);
		expect(() => publicLanguageParam(harness.runtime.db, 'fr')).toThrow(notFound);
		expect(() => publicLanguageParam(harness.runtime.db, '../etc')).toThrow(notFound);
	});

	it('accepts only well-formed slugs', () => {
		expect(slugParam('hello-world-2')).toBe('hello-world-2');

		for (const value of ['Hello', 'a--b', '-a', 'a/b', 'x'.repeat(121), '']) {
			expect(() => slugParam(value)).toThrow(notFound);
		}
	});

	it('reads positive whole page numbers only', () => {
		const url = (query: string) => new URL(`https://cms.example.com/blog/en${query}`);

		expect(pageParam(url(''))).toBe(1);
		expect(pageParam(url('?page=3'))).toBe(3);

		for (const query of [
			'?page=0',
			'?page=-1',
			'?page=1.5',
			'?page=abc',
			'?page=02',
			'?page='
		]) {
			expect(() => pageParam(url(query))).toThrow(notFound);
		}
	});
});
