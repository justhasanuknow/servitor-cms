# Contributing

Thank you for helping with Servitor CMS. Bug reports, fixes and translations are welcome. For larger changes, please open an issue first so we can agree on the approach. Everybody who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requirements: Node.js 24 and npm.

```bash
npm ci
cp .env.example .env
npm run dev
```

For local development, set `ORIGIN=http://localhost:5173` and keep the data in the project, for example `DATABASE_PATH=./data/servitor.db` and `UPLOADS_DIR=./data/uploads`. [docs/development.md](docs/development.md) describes the project structure, the commands, the tests and the migrations in detail.

## Checks

Run these before you open a pull request. Continuous integration runs the same steps and also builds the container.

```bash
npm run lint
npm run check
npm run test:unit -- --run
npm run test:e2e
```

## Conventions

- Code, commit messages and documentation are written in English.
- Code has no comments; clear names and small functions explain it.
- Formatting comes from Prettier; do not format by hand.
- User-facing text goes through Paraglide messages, with every key added to all six locales in `messages/`.
- Changes that users or operators notice are described in the documentation in `docs/`, which the app serves at `/docs`.
- New behavior needs tests, and permission-sensitive behavior needs tests for both allowed and refused cases.
- Keep commits focused and write their subjects in the imperative mood, for example "Add webhook retries".

## Security issues

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
