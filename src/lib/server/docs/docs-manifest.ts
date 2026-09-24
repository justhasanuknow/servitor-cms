import type { DocsSectionId } from '../../modules/interfaces/docs.interfaces';

export const DOCS_INDEX_FILE = 'README.md';

export const DOCS_SECTIONS: readonly { id: DocsSectionId; files: readonly string[] }[] = [
	{
		id: 'start',
		files: ['getting-started.md', 'installation.md', 'configuration.md']
	},
	{
		id: 'operate',
		files: ['deployment.md', 'operations.md', 'email.md']
	},
	{
		id: 'use',
		files: [
			'panel.md',
			'users.md',
			'posts.md',
			'publishing.md',
			'media.md',
			'languages-and-categories.md',
			'settings.md',
			'public-site.md'
		]
	},
	{
		id: 'integrate',
		files: ['api.md', 'webhooks.md']
	},
	{
		id: 'reference',
		files: ['security.md', 'SECURITY-REVIEW.md', 'troubleshooting.md', 'development.md']
	}
];
