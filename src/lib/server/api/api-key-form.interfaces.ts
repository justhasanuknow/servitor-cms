import type { ReauthenticationInput } from '../auth/reauthentication.interfaces';
import type { ApiKeyInput } from './api-keys.interfaces';

export type ApiKeyFormResult =
	| { status: 'ok'; input: ApiKeyInput; confirmation: ReauthenticationInput }
	| { status: 'invalid_input' | 'languages_required' | 'categories_required' };
