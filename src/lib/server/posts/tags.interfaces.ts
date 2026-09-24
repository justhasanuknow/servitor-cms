export type TagParseResult =
	{ status: 'ok'; names: string[] } | { status: 'too_many_tags' } | { status: 'tag_too_long' };
