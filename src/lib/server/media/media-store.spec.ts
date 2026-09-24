import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MediaStore } from './media-store';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

let root: string;

let store: MediaStore;

beforeEach(() => {
	root = join('.tmp', 'tests', `media-store-${crypto.randomUUID()}`);
	store = new MediaStore(root);
	store.prepare();
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe('MediaStore', () => {
	it('writes variants atomically into a directory named after the id', async () => {
		await store.save(ID, [{ variant: '480', data: Buffer.from('a'), width: 1, height: 1 }]);

		expect(readdirSync(root)).toEqual([ID]);
		expect((await store.read(ID, '480'))?.toString()).toBe('a');
		expect(await store.read(ID, '960')).toBeNull();
	});

	it.each(['../outside', '..', '', 'A3F2504E0-4F89-41D3-9A0C-0305E82C3301', `${ID}/../..`])(
		'refuses the id %j',
		async (id) => {
			await expect(store.read(id, '480')).rejects.toThrow();
			await expect(store.remove(id)).rejects.toThrow();
			await expect(
				store.save(id, [{ variant: '480', data: Buffer.from('a'), width: 1, height: 1 }])
			).rejects.toThrow();
		}
	);

	it('removes a media directory', async () => {
		await store.save(ID, [{ variant: 'full', data: Buffer.from('a'), width: 1, height: 1 }]);
		await store.remove(ID);

		expect(existsSync(join(root, ID))).toBe(false);
	});
});
