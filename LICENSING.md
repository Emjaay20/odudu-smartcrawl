# Licensing

Odudu is released under two licences. The directory a file lives in decides
which one covers it.

| Path                | Licence       |
| ------------------- | ------------- |
| `.`                 | AGPL-3.0-only |
| `apps/*`            | AGPL-3.0-only |
| `packages/*`        | AGPL-3.0-only |
| `tools/*`           | AGPL-3.0-only |
| `tests`             | AGPL-3.0-only |
| `apps/docs/content` | Apache-2.0    |
| `examples/*`        | Apache-2.0    |

The `.` row is the root `package.json`. The two Apache-2.0 rows apply when those directories are added: the example
applications under `examples/` and the site's prose under `apps/docs/content`.
A `package.json` that appears under either path without `Apache-2.0` fails
`tests/lint/licence-fields.test.ts`.

Anything not listed, including the repository's own documentation under
`docs/`, follows the root [`LICENSE`](LICENSE), which is the AGPL-3.0 text.
The Apache-2.0 text is in [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt),
and each example application carries its own copy as `LICENSE`.

The server, the console, the gateway and the command line are AGPL-3.0: they
are the service, and anyone who modifies Odudu and offers it over a network
must publish their changes. The site's prose and the example applications are Apache-2.0,
so that copying a guide or starting from an example is never constrained.
[ADR 0042](docs/adr/0042-distribution-licensing-and-the-paid-boundary.md)
has the reasoning and the alternatives rejected.

## Third-party material

The fonts the product serves are IBM Plex Sans and IBM Plex Mono, under the SIL
Open Font License 1.1. [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) lists
them with their copyright lines, and the documentation site publishes the
licence text beside the fonts.

## Headers

No per-file header is required. The directory decides, and a file copied out
of a directory carries its licence with it.

## What this means for you

An application that only talks to Odudu over OpenID Connect, OAuth 2.0 or the
admin API is not a derivative work of Odudu, whatever its own licence is.
Running an unmodified Odudu for your own organisation, or for your
customers' sign-in, places no obligation on that application.

If you modify Odudu and let other people use it over a network, the AGPL
requires you to offer them your modified source.

## Commercial licence

A commercial licence is offered to organisations whose policy forbids the
AGPL. Until a sales address exists, send an enquiry to the security contact
in [`SECURITY.md`](SECURITY.md).

## The name and the mark

The name Odudu and the staff mark are not licensed by either licence. The
licences grant rights to the code and the text, not to present a fork or a
service as Odudu.
