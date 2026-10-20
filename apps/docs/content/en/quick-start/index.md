---
title: Quick start
description: Start Odudu with Docker Compose, sign in to its console and sign a person in to an app of your own, in about ten minutes.
---

# Quick start

You will start Odudu on your own machine, sign in to its console as the first administrator, and then sign a person in to an app. It takes about ten minutes, and you need nothing installed except Docker and `curl`.

This is for trying Odudu out. The server listens on loopback only and the database password is fixed and public, so do not run it on a shared host.

## Before you start

You need Docker with Compose v2: Docker Desktop on macOS or Windows, or Docker Engine with the Compose plugin on Linux. Check with `docker compose version`. The command has a space in it; the older `docker-compose` is not Compose v2.

You also need `curl`, which macOS, Linux and current Windows ship. Postgres and the one-time setup step come in the stack. The stack publishes these ports on loopback only:

| Port | What                                                   | Change it with    |
| ---- | ------------------------------------------------------ | ----------------- |
| 3000 | The server and the console                             | `ODUDU_PORT`      |
| 8025 | The mail catcher's inbox, only with the `mail` profile | `ODUDU_MAIL_PORT` |

## 1. Start Odudu

One command downloads the file that describes the stack and starts it. The first start pulls the images, so give it a minute.

```text
curl -fsSLO https://github.com/wizzywit/odudu/releases/latest/download/compose.yaml && docker compose up -d
```

The file starts three things: Postgres, a one-time setup step that creates the database roles and the first administrator, and the server.

### If port 3000 is taken

Compose will say the port is already allocated. Choose another one with `ODUDU_PORT` and start again. In bash and zsh:

```text
ODUDU_PORT=3100 docker compose up -d
```

In PowerShell:

```text
$env:ODUDU_PORT = '3100'; docker compose up -d
```

Use that port wherever the rest of this page says 3000.

## 2. Copy the first password

The setup step prints the console address, the administrator's email and a generated password, once.

```sh {run expect="Odudu is ready"}
docker compose logs setup
```

You will see something like this, each line led by the container name that `docker compose logs` adds. Your password is different.

```text
Odudu is ready.

 console:  http://localhost:3000/console/
 email:    admin@odudu.local
 password: yjNimKOX…

The password is shown once and must be changed at first sign-in.
To remove it from the setup container log afterwards, run:

  docker compose rm -f setup
```

Want your own email? Set `ODUDU_ADMIN_EMAIL` before the first start, the same way as `ODUDU_PORT` above. Want to be asked for a password instead of being given one? Run `docker compose run --rm setup` from a terminal before you start the server.

Copy the password somewhere safe. The generated one stays readable in the setup container's log until the container is removed, so remove it now.

```sh {run}
docker compose rm -f setup
```

## 3. Sign in to the console

Open the console address from the banner, `http://localhost:3000/console/`, and sign in with the email and the password you copied. Odudu asks you to choose a new password before it lets you in. Do that, and you are in the admin console.

You have a running identity provider. The rest of this page makes it do its job.

## 4. Sign in to an app

An app asks Odudu to sign a person in. Odudu keeps people in a tenant, so you start by making one, then register your app as a client of it, then make a person.

Every command below talks to the server at one address. Set it once; if you moved the port, set it to that address instead.

```sh {run}
export ODUDU_BASE="${ODUDU_BASE:-http://localhost:3000}"
```

Make a tenant called `demo`. The tenant is the home of its own people, apps and keys.

```sh {run expect="tenantId"}
docker compose exec odudu odudu seed tenant --name demo
```

Register an app called `my-app`. It is a single-page app, which cannot keep a secret, so it is a public client. The redirect address is where Odudu sends the person after they sign in.

```sh {run expect="clientDbId"}
docker compose exec odudu odudu seed client --tenant demo --client-id my-app --public --redirect-uri http://localhost:8080/callback
```

Make a person called `ada`. The guides sign `ada` in with the password shown here, so keep it for now and choose your own for real users.

```sh {run expect="userSubjectId"}
docker compose exec odudu odudu seed user --tenant demo --username ada --password 'a long and unremarkable passphrase'
```

Now ask the tenant to sign `ada` in to `my-app`. This is the address your app sends the browser to. The `code_challenge` is part of PKCE, which every client uses, and the guides explain it.

```sh {run}
SIGN_IN="$ODUDU_BASE/tenants/demo/protocol/openid-connect/auth?response_type=code&client_id=my-app&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fcallback&scope=openid&state=abc123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256" && echo "$SIGN_IN"
```

Open that address in your browser. You see Odudu's sign-in page, named for `my-app` and the `demo` tenant. Sign in as `ada`. The browser then tries to open `http://localhost:8080/callback?code=...`, and because nothing listens there yet it shows a connection error. That is the end of the quick start: the address in the bar holds the one-time code your app would swap for tokens.

To check without a browser, ask for the page:

```sh {run expect="200"}
curl -sS -o /dev/null -w '%{http_code}\n' "$SIGN_IN"
```

## Where to next

Pick the guide for what you are building. Each one signs a person in, or a service, all the way to tokens.

- [A web app with a server](../guides/web-app.md), which keeps a secret.
- [A single-page app](../guides/single-page-app.md), which cannot.
- [An API](../guides/api.md) that receives tokens and decides whether to trust them.
- [A service calling a service](../guides/machine-to-machine.md), where no person signs in.

When you want to know what a tenant, a client and a token are, read [Concepts](../concepts/index.md).
