---
title: 'GET /console/'
description: "The logout's 302 lands on the console shell. Every path under /console/ that neither the API nor the sign-in routes claim answers the shell, with…"
---

# `GET /console/`

The logout's `302` lands on the console shell. Every path under `/console/`
that neither the API nor the sign-in routes claim answers the shell, with
the gateway's CSP, and each hashed asset the shell names is served
`immutable`. The shell holds Instrument's tokens, the app frame, the session
gate and the sign-in flow. Each area is a chunk of its own, fetched when its
route is first opened, which is why the shell names only the entry, the
chunks every page needs, and their stylesheets.

This section runs on a stack of its own, on `http://localhost:3187`. The shell
reads no cookie, so none is sent.

```bash
curl -sS -D - http://localhost:3187/console/
```

```
HTTP/1.1 200 OK
x-request-id: 01a140c4-98b3-78a7-9e5c-806cbeb103c2
content-type: text/html; charset=utf-8
content-security-policy: default-src 'self'; script-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o=' 'sha256-gYiS/BvZvRcK27JIXTuwhZ3hs2+VJ1X+2gUlE+farlg='; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'
x-frame-options: DENY
referrer-policy: no-referrer
cache-control: no-store
x-content-type-options: nosniff
content-length: 1124
Date: Thu, 15 Oct 2026 18:13:08 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Odudu console</title>
    <script type="module" crossorigin src="/console/assets/index-Cf7KEx-q.js"></script>
    <link rel="modulepreload" crossorigin href="/console/assets/rolldown-runtime-hePW80VL.js">
    <link rel="modulepreload" crossorigin href="/console/assets/zod-DEvWxZHY.js">
    <link rel="modulepreload" crossorigin href="/console/assets/PageHeader-swcs4fPt.js">
    <link rel="modulepreload" crossorigin href="/console/assets/useUrlSearch-BCpFpgTc.js">
    <link rel="modulepreload" crossorigin href="/console/assets/PageNotFound-CGcqeypr.js">
    <link rel="modulepreload" crossorigin href="/console/assets/useDrafts-Bqnb6iHY.js">
    <link rel="stylesheet" crossorigin href="/console/assets/PageHeader-D3NRoIlr.css">
    <link rel="stylesheet" crossorigin href="/console/assets/PageNotFound-OaJZDCvc.css">
    <link rel="stylesheet" crossorigin href="/console/assets/index-n9jwgC2c.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

The two style hashes are React Aria's own injected `<style>` elements —
`usePress`'s pressable style and, on iOS WebKit only, `usePreventScroll`'s
`overscroll-behavior: contain` rule — recomputed from the installed react-aria
by a test. The stylesheets are Instrument's tokens and fonts and the shared
pieces' styles, built and hashed like any other asset.

```bash
curl -sS -D - -o /dev/null http://localhost:3187/console/assets/index-Cf7KEx-q.js
```

```
HTTP/1.1 200 OK
x-request-id: 01a140c5-0e77-7ae2-83b6-927449114fb5
content-type: text/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
content-length: 365185
Date: Thu, 15 Oct 2026 18:13:38 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

The entry is 365,185 bytes. The Subjects area's chunk is not in the shell; it
is fetched when `/console/<tenant>/subjects` is first opened, and is the
largest chunk the build makes:

```bash
curl -sS -D - -o /dev/null http://localhost:3187/console/assets/subjects-WNaHQGIi.js
```

```
HTTP/1.1 200 OK
x-request-id: 01a140c5-0e86-79c8-92f2-a50b5300936a
content-type: text/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
content-length: 390585
Date: Thu, 15 Oct 2026 18:13:38 GMT
Connection: keep-alive
Keep-Alive: timeout=72
```

```bash
cd infra/docker
COMPOSE_PROJECT_NAME=odudu-fix18b ODUDU_HOST_PORT=3187 POSTGRES_HOST_PORT=5487 \
  ODUDU_CONSOLE_CLIENT_KEY=$(./console-key.sh) docker compose down -v
```
