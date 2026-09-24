# Contributing

Thank you for helping with Servitor CMS. Bug reports, fixes and translations are welcome. For larger changes, please open an issue first so we can agree on the approach. Everybody who takes part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues

Open issues with one of the forms: bug report, feature request, documentation or question, and panel translation. Blank issues are turned off so that every report carries the information needed to act on it. New issues get the `triage` label; a maintainer removes it after a first look and adds the labels below.

| Label                                                    | Meaning                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `bug`                                                    | Something does not work as documented.                              |
| `enhancement`                                            | A new feature or an improvement.                                    |
| `documentation`, `question`                              | The documentation, or a question it does not answer yet.            |
| `accessibility`                                          | Keyboard, screen reader, contrast and other accessibility problems. |
| `translations`                                           | Panel texts and panel languages.                                    |
| `security`                                               | Hardening. Vulnerabilities are reported privately, never here.      |
| `breaking`                                               | Changes behavior or configuration in an incompatible way.           |
| `ci`                                                     | Continuous integration and repository tooling.                      |
| `good first issue`, `help wanted`                        | Open for contributions.                                             |
| `duplicate`, `invalid`, `wontfix`                        | Reasons for closing without a change.                               |
| `dependencies`, `javascript`, `docker`, `github_actions` | Set by Dependabot on its pull requests.                             |

## Pull requests

- Work on a branch in your fork, or in this repository if you have write access, never on `main`. Name it after the change, for example `fix/webhook-timeout` or `docs/nginx-example`.
- Fill in the pull request template and link the issue, for example `Closes #12`.
- The title says what the change does in the imperative mood, such as "Add webhook retries". Pull requests are squash-merged, so the title becomes the commit subject on `main`.
- `main` accepts changes only through pull requests: continuous integration (`verify` and `docker`) must pass, review threads must be resolved, and changes by others than the maintainer need an approving review from a code owner. Force pushes and deleting `main` are blocked.
- Keep a pull request focused on one change. Update it with new commits instead of force-pushing while it is under review.

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
