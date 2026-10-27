---
title: First start
description: The Compose stack and odudu init as run on a real stack, with every refusal and exit status, and what each leaves on disk.
---

# First start

Two ways take an empty database to a console you can sign in to: the Compose stack's setup step, and `odudu init`, which the setup step runs. These are the runs behind [the quick start](../../quick-start/index.mdx), with the refusals the quick start leaves out.

## The Compose stack

`quickstart/compose.yaml` starts Postgres, a
one-time `setup` step that runs `odudu init`, and the server, on
`http://localhost:3000` (`ODUDU_PORT` moves it, to a number from 1 to 65535, chosen before the first start: `setup` writes the address once, so change the port later with `docker compose down -v` and a new start, which erases the data).
With no input at all:

```
$ docker compose up -d
$ docker compose logs --no-log-prefix setup

Odudu is ready.

 console:  http://localhost:3250/console/
 email:    admin@odudu.local
 password: <generated>

The password is shown once and must be changed at first sign-in.
To remove it from the setup container log afterwards, run:

  docker compose rm -f setup

```

Run against a build of the image made from this repository (`ODUDU_PORT=3250`, a new
Compose project, nothing run before it); the generated
password is replaced by `<generated>`. `ODUDU_ADMIN_EMAIL` names another
administrator, and `ODUDU_ADMIN_PASSWORD` a password of your own instead of a
generated one. In a `.env` file write a password with a `$` or `#` in single
quotes, as `quickstart/.env.example` shows, or Compose changes it; a password
from the environment stays in the stopped `setup` container until
`docker compose rm -f setup`. `docker compose up -d` is safe to repeat: a later
`setup` finds the administrator and exits 0.

Compose gives a service no terminal under `up`, so the prompt is a second
command: `docker compose run --rm setup` asks for the email and the password
(twice, not echoed), and `docker compose up -d` then starts the server.

```
$ docker compose run --rm setup
Administrator email: nobody
That is not an email address. Try again.
Administrator email: grace@example.com
Password:
Repeat password:

Odudu is ready.

 console:  http://localhost:3250/console/
 email:    grace@example.com

Sign in with the password you chose.

$ docker compose up -d
$ docker compose logs --no-log-prefix setup
An administrator already exists. Console: http://localhost:3250/console/
If you cannot sign in, `odudu seed admin --username <name>` creates another.
```

The second transcript is a run through a pseudo-terminal, with the carriage
returns and the typed lines left out. Postgres publishes no port, but on
Linux any process on the machine can reach a container's address and the
database password in the file is public: do not use it on a shared host.
While a person types at the prompt a concurrent `setup` waits for them, up to
a minute, and then gives up.

`admin@odudu.local` is public knowledge, so the protection is the generated
password, which is shown once and must be changed at first sign-in; bring the
stack up only where the published port is loopback, as the file binds it. A
terminal with `ODUDU_ADMIN_PASSWORD` set and no email uses that address
without asking for the email.

This is not a production deployment ([Deploying](../../operating/deploying.md) is).
The server runs with `NODE_ENV=development` because every guard that variable
switches on lives in `apps/server/src/config-guard.ts`, and the one a loopback
http stack cannot meet is the TLS guard: every cookie loses `Secure` and
the `__Host-` prefix. The others (the owner role kept off the serving path,
the published example KEK, private client URLs, a public base URL for
passkeys) are met or unused here.

## `odudu init`

One command takes an empty database to a
signed-in console: it creates the `odudu_app` and `odudu_svc` roles, applies
the migrations, creates the `system` tenant and one administrator, and writes
`quickstart.env` for the server to start from. It needs only the owner
connection, `ODUDU_DATABASE_URL`, and it is safe to run again.

| Input                        | Meaning                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `--admin-email`              | The administrator's address and sign-in name. Default `ODUDU_ADMIN_EMAIL`, then asked for on a terminal, else `admin@odudu.local`. |
| `--state-dir`                | Where `quickstart.env` goes. Default `/var/lib/odudu`, created `0700`; an existing one writable by group or others is refused.     |
| `--public-base-url`          | Where the server will be reached. Default `ODUDU_PUBLIC_BASE_URL`, then `http://localhost:3000`.                                   |
| `--add-admin`                | Add a second administrator. Without it a different `--admin-email` is refused.                                                     |
| `ODUDU_ADMIN_PASSWORD` (env) | A password to use instead of a generated one; never an option, so not in `ps`. Empty is unset.                                     |

`quickstart.env` is created `0600`, complete or not at all, and never
overwritten: it holds the owner and service database URLs, `ODUDU_KEK`, the
console's client key and the base URL, so a second run reuses the same KEK
instead of rotating it. Two runs at once are serialised by a Postgres advisory
lock. On a terminal, `init` asks for the password, twice and without echoing it, when none
is given; otherwise a generated password is printed once and must be changed at first
sign-in; a chosen one is checked against the system tenant's password policy,
never printed, and not forced to change. A run against an administrator that
already exists changes nothing. If its password is lost, `odudu seed admin
--username <name>` creates another administrator with a new one-time password.
`init` serves plain http on loopback only and refuses any other
`--public-base-url`; a public deployment is configured by hand
([Deploying](../../operating/deploying.md)). If `odudu_svc` exists but `quickstart.env` does not,
`init` refuses rather than reset a password it cannot know; restore the file or
drop the role. The service role is created from a SCRAM-SHA-256 verifier, so
the password is not in `log_statement` output.

Commands are shown as `odudu`, which is `node apps/server/src/main.ts` here.
Run against an empty `postgres:17-alpine` (a new Compose project, the owner
`odudu`, nothing else run before it), from the repository root with
`NODE_NO_WARNINGS=1 ODUDU_DATABASE_URL=postgres://odudu:…@127.0.0.1:54733/odudu`;
the generated password is replaced by `<generated>` and the chosen one by
`<chosen>`. Output is exactly as printed; `echo "exit $?"` is typed after a refusal to
show the shell's exit status:

```
$ odudu init --state-dir ./state --admin-email ada@example.com

Odudu is ready.

 console:  http://localhost:3000/console/
 email:    ada@example.com
 password: <generated>

The password is shown once and must be changed at first sign-in.
To remove it from the setup container log afterwards, run:

  docker compose rm -f setup

$ node -e 'for (const f of ["state", "state/quickstart.env"]) console.log((fs.statSync(f).mode & 0o7777).toString(8).padStart(4, "0"), f)'; cut -d= -f1 state/quickstart.env
0700 state
0600 state/quickstart.env
ODUDU_KEK
ODUDU_CONSOLE_CLIENT_KEY
ODUDU_DATABASE_URL
ODUDU_APP_DATABASE_URL
ODUDU_PUBLIC_BASE_URL
ODUDU_CONSOLE
$ odudu init --state-dir ./state --admin-email ada@example.com
The administrator ada@example.com already exists. Console: http://localhost:3000/console/
If you cannot sign in, `odudu seed admin --username <name>` creates another.
$ odudu init --state-dir ./state --admin-email grace@example.com; echo "exit $?"
the system tenant already has an administrator and grace@example.com is not it; pass --add-admin to add another
exit 1
$ ODUDU_ADMIN_PASSWORD=<chosen> odudu init --state-dir ./state --admin-email grace@example.com --add-admin

Odudu is ready.

 console:  http://localhost:3000/console/
 email:    grace@example.com

Sign in with the password you chose.
It stays in the setup container environment until that container
is removed: docker compose rm -f setup

$ odudu init --state-dir ./state; echo "exit $?"
An administrator already exists. Console: http://localhost:3000/console/
If you cannot sign in, `odudu seed admin --username <name>` creates another.
exit 0
$ odudu init --state-dir ./state --public-base-url https://id.example.com --admin-email ada@example.com; echo "exit $?"
ODUDU_PUBLIC_BASE_URL is "https://id.example.com", which is not a loopback address: odudu init is for a machine you are sitting at and serves over plain http on localhost. To run on a public address, configure the server yourself: see Deploying in the Operating section of the documentation
exit 1
$ mv state/quickstart.env state/old.env; odudu init --state-dir ./state --admin-email ada@example.com; echo "exit $?"
the odudu_svc role exists but state/quickstart.env does not, so its password is unknown; restore the file, or drop the role if this database is disposable
exit 1
```
