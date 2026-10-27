---
title: 'The documentation under /docs'
description: 'The image carries its own copy of the documentation, built at the version the image is, and the server answers it from its own origin at /docs/.'
---

# The documentation under `/docs`

The image carries its own copy of the documentation, built at the version the
image is, and the server answers it from its own origin at `/docs/`. It is a
static site read once at boot into memory (`ODUDU_DOCS_DIR`, `/app/docs`), so no
request touches the filesystem; a path that is not a file of the build is `404`.
It reads no database and takes nothing from the request, so it says nothing
about any tenant. `ODUDU_DOCS=false` registers nothing.

On a new stack on port `3261`, with no tenant seeded: the site is the same on
any stack. `date`, `x-request-id`, `connection` and `keep-alive` change on every
response and are filtered out in the command.

A bare `/docs` is sent to the directory. Every response the route produces
carries `x-robots-tag: noindex, nofollow`, redirect included. Fastify's own `400`
for a malformed percent-escape and its `404` for a method other than `GET` or
`HEAD` are not the route's and carry none of the docs headers:

```
$ curl -sI http://localhost:3261/docs | tr -d '\r' | grep -viE '^(date|x-request-id|connection|keep-alive):'
HTTP/1.1 308 Permanent Redirect
content-security-policy: default-src 'none'
x-frame-options: DENY
referrer-policy: no-referrer
x-content-type-options: nosniff
x-robots-tag: noindex, nofollow
content-language: en
location: /docs/
content-length: 0

```

The home page runs under a policy computed when the image was built: the one
inline script (the colour-mode initialiser, the same on every page) by hash, and
the `style=` attributes the theme writes (the code blocks' colours and a hidden
icon sprite) by hash with `'unsafe-hashes'`, which only `style-src-attr` carries.
There is no `'unsafe-inline'` and no `'unsafe-eval'`, and the policy is the same
on every response the route produces (ADR 0029's second amendment). `data:` images are
the theme's own icons. The page revalidates by `etag`:

```
$ curl -sI http://localhost:3261/docs/ | tr -d '\r' | grep -viE '^(date|x-request-id|connection|keep-alive):'
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'sha256-XzbohOdLBHFS8lNAlXYAVACbmod6JzK/jbZ8kS4rKFA='; style-src 'self'; style-src-attr 'unsafe-hashes' 'sha256-Ttpoc3tSKRg5N48uBLnp89v0S8hV/3pNb8OivYW4Jak=' 'sha256-biLFinpqYMtWHmXfkA1BPeCY0/fNt46SAZ+BBk5YUog='; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
x-frame-options: DENY
referrer-policy: no-referrer
x-content-type-options: nosniff
x-robots-tag: noindex, nofollow
content-language: en
etag: "rNNQhY6VaZbT7Gzyooq-8LqoH4W"
cache-control: no-cache
content-type: text/html; charset=utf-8
content-length: 12191

```

The `content-length` above and the hashed file name below belong to the docs build
that ran; every build changes them, so nothing here depends on them.

A file named by its content, in the build's `assets` directory, is `immutable`. A file with a
fixed name, such as the agent copy `llms.txt`, a Markdown copy of a page or the
search index, revalidates, and carries the same `x-robots-tag`:

```
$ curl -sI http://localhost:3261/docs/assets/js/main.21a3a812.js | tr -d '\r' | grep -iE '^(HTTP|content-type|cache-control|x-robots-tag|etag)'
HTTP/1.1 200 OK
x-robots-tag: noindex, nofollow
etag: "Bzj_QBy2JbNi6YOlPkKrAqw-o8c"
cache-control: public, max-age=31536000, immutable
content-type: text/javascript; charset=utf-8
$ curl -sI http://localhost:3261/docs/llms.txt | tr -d '\r' | grep -iE '^(HTTP|content-type|cache-control|x-robots-tag|etag)'
HTTP/1.1 200 OK
x-robots-tag: noindex, nofollow
etag: "nFmJkzvMCSoZKlF_aLktKFIvSbO"
cache-control: no-cache
content-type: text/plain; charset=utf-8
```

A path that is not a file of the build is the site's own `404` page with status
`404`, not the home page, under the same headers. So is every form of
traversal, sent as written (`--path-as-is`) so that `curl` does not tidy it
first, because the lookup is an exact key and nothing is read from disk per
request. `csp.json`, the file the policy is read from, is not a document of the
site and is `404` too:

```
$ curl -sI http://localhost:3261/docs/nope/ | tr -d '\r' | grep -iE '^(HTTP|content-type|cache-control|x-robots-tag)'
HTTP/1.1 404 Not Found
x-robots-tag: noindex, nofollow
cache-control: no-cache
content-type: text/html; charset=utf-8
$ curl -s --path-as-is -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3261/docs/../package.json
404 text/html; charset=utf-8
$ curl -s --path-as-is -o /dev/null -w '%{http_code} %{content_type}\n' 'http://localhost:3261/docs/..%2f..%2fetc%2fpasswd'
404 text/html; charset=utf-8
$ docker compose exec -T odudu ls /app/docs/csp.json
/app/docs/csp.json
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3261/docs/csp.json
404
```

With `ODUDU_DOCS_DIR` naming a directory that is not there, the server still
starts; `/docs/*` answers `503` and the log names both variables. The same stack,
recreated with `ODUDU_DOCS_DIR=/nonexistent`:

```
$ curl -sI http://localhost:3261/docs/ | tr -d '\r' | grep -iE '^(HTTP|x-robots-tag|content-security-policy|x-content-type-options)'
HTTP/1.1 503 Service Unavailable
content-security-policy: default-src 'none'
x-content-type-options: nosniff
x-robots-tag: noindex, nofollow
$ docker compose logs odudu | grep -o '"msg":"ODUDU_DOCS_DIR.*'
"msg":"ODUDU_DOCS_DIR (/nonexistent) cannot be served, ENOENT: no such file or directory, scandir '/nonexistent'; /docs/* answers 503; set ODUDU_DOCS=false to turn the documentation off"}
```

And recreated with `ODUDU_DOCS=false`, no route is registered, so `/docs/` is as
unknown as any path the server has no route for:

```
$ curl -sI http://localhost:3261/docs/ | grep -iE '^(HTTP|content-type)'
HTTP/1.1 404 Not Found
content-type: application/problem+json; charset=utf-8
```

The site must be at the root of the origin `ODUDU_PUBLIC_BASE_URL` names. Its
links name `/docs/`, so a reverse proxy that mounts the server under a path
prefix breaks them; that is unsupported. The route never builds an address from
`Host` or a forwarded header (a test sends hostile ones and asserts none appears
in any response), and the pages carry no absolute link to another origin but the
repository.
