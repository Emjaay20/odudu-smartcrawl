---
title: 'Sending queued mail: odudu send-mail'
description: 'No request in these pages sends mail. Address verification, self-registration and password reset each write the message to email_outbox in the…'
---

# Sending queued mail: `odudu send-mail`

No request in these pages sends mail. Address verification, self-registration
and password reset each write the message to `email_outbox` in the transaction
that mints the token it carries, and answer; a second pass hands it to the
transport. That is what keeps an SMTP round trip out of a response — and out of
the _timing_ of one, which is what the two indistinguishable answers in
[Password reset](./password-reset.md) would otherwise have leaked.

The server runs this pass itself every `ODUDU_OUTBOX_INTERVAL_SECONDS`
(default `15`) plus up to a tenth as jitter, which is why the captures
above appear in `docker compose logs odudu` a moment after the request
rather than in the response. `ODUDU_OUTBOX_ENABLED=false` switches that
schedule off for a deployment that runs the command on its own timetable
([ADR 0024](https://github.com/wizzywit/odudu/blob/main/docs/adr/0024-a-scheduled-pass-is-a-command-first.md)) — and the
stack below was started that way, so the queue stays put long enough to
look at:

```bash
ODUDU_OUTBOX_ENABLED=false docker compose up -d
curl -sS -o /dev/null -X POST \
  http://localhost:3000/tenants/reset-demo/login-actions/reset-password \
  --data-urlencode 'email=ada@example.com'
docker compose exec -T postgres psql -U odudu -d odudu -q -c \
  'select to_address, attempts, sent_at, next_attempt_at <= now() as due
     from email_outbox where sent_at is null;'
```

```
   to_address    | attempts | sent_at | due
-----------------+----------+---------+-----
 ada@example.com |        0 |         | t
(1 row)
```

Queued, never attempted, and due. The command sends it:

```bash
docker compose exec -T odudu node dist/main.js send-mail
```

```
{"ran":true,"sent":1,"failed":0}
```

(Two pino lines precede that summary on the way past — one saying
`ODUDU_SMTP_HOST is unset; capturing outgoing mail instead of sending it`,
and then the captured message itself, in the shape
[Address verification](./path-a-as-a-confidential-client.md#address-verification) shows. Only the outcome is
repeated here.)

The capture the request used to produce inside its own response is now
produced here, by the sender, on the way past — and the row records that it
went:

```bash
docker compose exec -T postgres psql -U odudu -d odudu -q -c \
  'select to_address, attempts, sent_at is not null as sent from email_outbox
     order by created_at desc limit 1;'
```

```
   to_address    | attempts | sent
-----------------+----------+------
 ada@example.com |        1 | t
(1 row)
```

(The `limit 1` is what makes that a claim about the message just sent.
`email_outbox` keeps a delivered message for `ODUDU_RETENTION_EMAIL_SENT_SECONDS`,
so by this point in the document the table also holds every verification and
reset message the sections above queued.)

A second run has nothing due:

```bash
docker compose exec -T odudu node dist/main.js send-mail
```

```
{"ran":true,"sent":0,"failed":0}
```

Running it from more than one place at once is safe, and — unlike
[`odudu reap`](./retention-what-odudu-reap-removes.md) — it does not serialise
them. The claim is a single `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP
LOCKED)` per tenant: two senders that meet on one queue take different
messages and both make progress, where a lock would have had one of them do
nothing. The claim also counts the attempt and pushes `next_attempt_at`
five minutes out, so a sender killed between the claim and the send costs
that wait and no more.

**A transport failure cannot change any response.** It arrives here, long
after the request it belongs to was answered, so there is no status for it
to alter: the submission that queued the message has already returned its
`200` (or the `201` self-registration returns), and an SMTP outage neither
fails a registration nor tells a reset request's two paths apart. Before
the queue existed, a send that threw during registration answered `500`
and a reset request logged the failure and answered `200` anyway; now
neither case exists, because nothing on a request path holds a transport at
all.

A refused message keeps its place and its reason: `last_error`, and a
`next_attempt_at` one `ODUDU_OUTBOX_RETRY_BACKOFF_SECONDS` out, doubling
per attempt. After `ODUDU_OUTBOX_MAX_ATTEMPTS` (default `5`) it is offered
no further — and still there, with its error, for
[`odudu reap`](./retention-what-odudu-reap-removes.md) to bound rather than for
the sender to discard.

`send-mail` refuses to run at all in the same two configurations `reap`
does, and for the same reason: its claim is scoped by the tenant policy.
With `ODUDU_APP_DATABASE_URL` unset:

```bash
docker compose exec -T odudu env -u ODUDU_APP_DATABASE_URL node dist/main.js send-mail
```

```
odudu send-mail requires ODUDU_APP_DATABASE_URL: it claims under the tenant policy, which the owner role the migrations use escapes
```

and pointed at the owner:

```bash
docker compose exec -e ODUDU_APP_DATABASE_URL=postgres://odudu:odudu@postgres:5432/odudu \
  -T odudu node dist/main.js send-mail
```

```
the outbox sender claims under the tenant policy, so its serving connection must be subject to it; ODUDU_APP_DATABASE_URL names a SUPERUSER or BYPASSRLS role
```

Symmetrically, a `ODUDU_DATABASE_URL` role that cannot bypass row-level
security reads no tenants, and the queue would drain never with nothing to
say so; that is refused too. The schedule inside the server is the one
place that does not refuse per attempt: with no serving connection it
declines to start at all, warning
`not sending queued mail: ODUDU_APP_DATABASE_URL is unset` once, rather
than throwing this every fifteen seconds for the life of the process. **With the schedule off and no command
scheduled anywhere, queued mail is never sent** — and every flow that
queued it still answers exactly as it does when mail is going out, by
design, since the reset endpoint must not answer differently for an address
that exists.
