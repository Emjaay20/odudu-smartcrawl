# Changelog

All notable changes to Odudu are written here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) as [RELEASING.md](RELEASING.md) describes.

## [Unreleased]

### Added

- Pages measured on every change against Core Web Vitals and Lighthouse budgets, so the documentation and the landing page stay fast.
- The landing page shows the pages people see when they sign in, and says what is planned for agents and branding.

### Changed

- Logout shows every front-channel logout frame before it redirects to a matched post-logout address.
- Code blocks in the documentation are coloured when the site is built, and read well in both themes.
- Dependencies are updated again.

### Fixed

- A password reset finds the account whatever the case of its address.
- Two sign-ups with the same address at the same moment can no longer both succeed.
- Failures are logged with their message and stack, and a verification form that failed now shows its page.

### Security

- A mailed link that sets a password now ends every session and token the person had, and proves the address.
- When an address is verified or changed, the account is no longer treated as self-registered. A reset removes authenticators and recovery codes only on an account that registered itself and was never verified.
- Logout tokens carry the issuer of the request, and a server in production refuses to start when `ODUDU_TLS` and the `https` or `http` of the public base address disagree.

## [0.1.0-rc.3] - 2026-10-24

The third release candidate. Odudu is not production ready: it has had no security review.

### Changed

- Dependencies are updated across the server, the console, the examples and the base images, including nginx and tsup.
- Dependabot opens grouped pull requests and leaves Node major versions to a manual yearly move.

### Fixed

- A flaky registration test and two lint findings that newer tooling raised.

## [0.1.0-rc.2] - 2026-10-24

The second release candidate. Odudu is not production ready: it has had no security review.

### Added

- The documentation site is published on GitHub Pages, at https://wizzywit.github.io/odudu/.
- The contributor license agreement is approved and checked on pull requests. Contributors outside the allowlist sign by comment.

### Changed

- The README and the pages say release candidate where they said not ready.
- The quick start downloads the compose file of this candidate.
- Dependencies are updated: fastify, drizzle-orm, jose, prettier, libphonenumber-js and react-query, and vite in the example.
- CI retries the browser install, and updates the GitHub Actions cache.

### Security

- Dependency updates bring in the upstream fixes of the packages above.

## [0.1.0-rc.1] - 2026-10-23

The first release candidate. Odudu is not production ready: it has had no security review.

### Added

- A container image on `ghcr.io/wizzywit/odudu`, for amd64 and arm64, signed, with a list of its contents and a record of how it was built.
- A quick start in one command: `docker compose up -d` starts Postgres and Odudu, makes the database roles and the first administrator, and prints a one-time password.
- The `odudu` command in the image: `odudu init`, `odudu help` and `odudu --version`.
- The documentation, served by the server at `/docs/` and published as a site: a quick start, guides, concepts, a tour of the console, operating and reference pages.
- Four small example apps that sign in with Odudu: a web app, a single-page app, an API and a machine-to-machine client.
- A sign-up button: an app sends `prompt=create` to open the registration page, and discovery lists `prompt_values_supported`.
- A hand-tested guide to signing in to WordPress.
- Sign-in pages, error pages and mail in one shared look, with their text in message catalogues.
- A language chosen for each page from `ui_locales` and the browser's `Accept-Language`.
- Sign-in with the authorization code flow and PKCE, refresh tokens, client credentials, token exchange and single sign-on.
- Many tenants on one server, each with its own people, clients, keys and settings.
- Passwords, passkeys, authenticator codes and recovery codes.
- An admin API and an admin console, and an audit trail of every change and sign-in.

### Changed

- Password rules follow NIST SP 800-63B-4.
- One setting now decides the lifetime and shape of every cookie the server sets.
- Built-in scopes can be deleted, by typing their name, and restored.
- The issuer in tokens, discovery and logout is the configured `ODUDU_PUBLIC_BASE_URL`, never a request's `Host` header.
- A password reset ends every session and token the person had.

### Security

- Base images are pinned by digest, and a test keeps them so.
- Registering with an address that is already taken no longer says that it is taken, when email verification is on.
- Cookies are `Secure` and `__Host-` prefixed under `ODUDU_TLS`, from one setting; before, the session cookie ignored it.
- Characters that change the direction of text are refused in names and usernames.

[Unreleased]: https://github.com/wizzywit/odudu/compare/v0.1.0-rc.3...HEAD
[0.1.0-rc.3]: https://github.com/wizzywit/odudu/compare/v0.1.0-rc.2...v0.1.0-rc.3
[0.1.0-rc.2]: https://github.com/wizzywit/odudu/compare/v0.1.0-rc.1...v0.1.0-rc.2
[0.1.0-rc.1]: https://github.com/wizzywit/odudu/releases/tag/v0.1.0-rc.1
