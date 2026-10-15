# 0023 — Brute-force authority is split: the account is Postgres's, the CPU is the process's

**Status:** Accepted · 2026-09-16

**Renamed 2026-09-22:** written when a tenant was called a realm; the decision is unchanged.

## Context

RFC 6749 §2.3.1's "MUST protect any endpoint utilizing a password … against
brute force attacks" is already half held. The per-account lockout
(`login_failures`, `packages/domain-identity/src/service/lockout.ts`) counts
consecutive failures per subject, refuses every attempt for a growing
window once the tenant's threshold is reached, and is on in every tenant by
default. What it does not cover is anything not keyed to an account:

- One password tried against a thousand accounts. Each account sees one
  failure, so no counter ever reaches its threshold, and the server pays an
  Argon2id verification per attempt.
- `POST /tenants/{tenant}/login-actions/registration`, which is
  unauthenticated and runs an Argon2id **hash** — the expensive direction —
  per request, for an attacker who needs no account at all.
- `POST /tenants/{tenant}/login-actions/reset-password`, which does a lookup
  and a mail send per request.

These are not account-safety problems. They are cost problems: the resource
being spent is this process's CPU and this deployment's mail quota. That
difference is what the decision below turns on.

### Two places the limit could live

**(a) A row in Postgres, keyed by origin, like `login_failures` is keyed by
subject.** Globally true across replicas, survives a restart, and reuses a
mechanism that already exists.

**(b) A sliding window in this process's memory.** Per instance, lost on
restart, and cheap.

## Decision

**(b), and the split is deliberate: the property that must be globally true
lives in the database, and the property that is local lives locally.**

`slidingWindow` (`apps/server/src/throttle.ts`) keeps a per-key window in
memory. An `onRequest` hook in `apps/server/src/app.ts` applies it, keyed on
`request.ip`, to exactly three routes:
`POST /tenants/{tenant}/login-actions/authenticate`, `…/registration` and
`…/reset-password`. `ODUDU_THROTTLE_LIMIT` (default `10`) and
`ODUDU_THROTTLE_WINDOW_SECONDS` (default `60`) are the budget. A refused
request answers `429` with `Retry-After` and no body.

Three properties this shape is chosen for:

1. **The refusal is decided before anything account-dependent.** At
   `onRequest` nothing has parsed a body or looked a subject up, so a
   throttled request cannot answer differently for an address the server
   knows than for one it does not. The lockout holds its
   indistinguishability by paying the Argon2id cost either way; the
   throttle holds it by refusing before the question is asked.
2. **A refused request is not recorded.** Retrying inside the window does
   not extend the wait. An attempt during an account lockout deliberately
   does the opposite, because that mechanism is protecting a credential and
   this one is issuing a budget.
3. **The key map is bounded outright**, at `MAX_THROTTLE_KEYS`, evicting
   the least-recently-seen key. A limiter keyed on a value the caller
   chooses is a memory-exhaustion vector of its own, and eviction by
   insertion order would discard the attacker being throttled — that key
   was inserted first — handing back a fresh budget every time the ceiling
   was reached.

**The maximum password length is part of the same decision**, and it is
enforced at the read rather than in the policy. `readPasswordField`
(`packages/kernel/src/password-field.ts`) caps a form-borne password at
`MAX_PASSWORD_LENGTH` = 256 code points, counted the way
`password_min_length` is counted. The tempting home is `evaluatePassword`,
which already owns `minLength` — but the login route does not evaluate the
policy, it _verifies_, so a bound stated only there would leave the one
route an attacker controls paying an Argon2id verification for input of any
length. The cap is therefore at every read, and `evaluatePassword` carries
it as well, so the seed CLI — a writer that reads no form — cannot store a
password the login form would refuse. Over-long input is refused, never
truncated: truncation would make two different passwords authenticate one
account.

256 is not a password-strength opinion. ASVS 2.1.2 asks that at least 64
characters be permitted and allows denying more than 128; this is double
the point at which denial becomes permissible, so no passphrase anybody
would type is refused, and it bounds the attacker-controlled input to the
key derivation at roughly a kilobyte of UTF-8. It is not a tenant setting,
because it exists to bound work rather than to shape passwords.

## Consequences

- **The limit is per instance.** N replicas behind a load balancer admit up
  to N × the budget. This is accepted rather than worked around: the
  throttle protects _this process's_ CPU, which is this process's business,
  and the thing that must be true globally — an account locks after five
  consecutive failures, wherever those failures arrive — is the one already
  in Postgres. A per-instance CPU budget with N instances is N instances
  each protecting itself, which is the correct shape for the resource being
  protected.
- **It cannot be demonstrated here.** There is no load balancer in this
  repository and no second replica to put behind one, so `README.md` states
  the limitation rather than showing a transcript nobody produced.
- **Nothing stops a deployment running replicas anyway, so the exposure is
  real rather than theoretical.** "Run one instance" is an instruction in
  `README.md`'s "Deploying" and nowhere else: no boot path refuses a second
  process, and the reason it is given — migrations take no advisory lock —
  is a race an operator may never observe. An operator who scales out gets
  N times the budget, silently. Writing that down is the whole mitigation
  available today; a limit that held across instances is P11's, with the
  shared session cache and the migration lock.
- **A flood from more genuinely distinct addresses than the ceiling holds
  is bounded loosely.** Past `MAX_THROTTLE_KEYS` the coldest key is
  dropped, so a botnet of a hundred thousand real addresses — no header
  spoofing needed — sees its earliest keys forgotten and re-budgeted every
  ten thousand or so insertions. Accepted, because eviction is fail-open
  only: it forgets hits and never invents them, so no volume of keys can
  make the throttle refuse an address that has not spent its budget. A
  bound that instead refused on eviction would turn the ceiling into a
  denial-of-service lever pointed at legitimate traffic.
- **The budget is shared across the three routes**, not one per route. An
  origin gets a CPU allowance, and whether it spends it on logins or on
  registrations is not the throttle's business.
- **It depends on `request.ip` being trustworthy.** With
  `ODUDU_TRUST_PROXY` off, that is the socket's peer address. With it on,
  `X-Forwarded-For` is trusted, so an operator whose proxy _appends_ rather
  than overwrites that header leaves the key client-controlled and the
  throttle decorative. `infra/conformance/proxy/nginx.conf` sets
  `X-Forwarded-For $remote_addr` for exactly this reason, and `README.md`
  says it as a deployment requirement.
- **A shared address shares a budget.** Ten submissions a minute from one
  NAT covers a small office and not a large one, which is what
  `ODUDU_THROTTLE_LIMIT` is for. There is no value that switches it off:
  the floor is one.
- **A restart empties the window.** An attacker who can restart the server
  has larger levers; an attacker who cannot must wait it out.
- **`/token` is not throttled by this.** It is client-authenticated and
  hot, and the budget above is keyed by origin, which for a server-side
  client is one address for every request it will ever make. That is not a
  claim that `/token` needs no protection: what RFC 6749 §2.3.1's
  client-authentication half asks for is a limit keyed by _client_, and
  this throttle is not where that goes — see the amendment below for where
  it did.

## Amendment, 2026-09-18 — the client half, built

RFC 6749 §2.3.1's clause has two endpoints, and the consequence above named
the second without closing it: "what that clause asks for is a limit keyed
by _client_. This throttle is not where that goes." P3a builds that limit.

**A second `slidingWindow` instance, keyed by `tenant_id:client_id`, counting
only failed `client_secret_basic`/`client_secret_post` attempts at
`/token`.** `authenticateClient`
(`packages/protocol-oidc/src/usecase/token-issuance.ts`) consults it, on a
`ClientSecretLimiter` dependency injected rather than imported — the layer
boundary that made `slidingWindow` unreachable from `protocol-oidc` runs
the same direction here, and `apps/server/src/app.ts` is the one caller that
wires a real, memory-bounded instance in. `oidcRoutes`'s `clientSecretLimiter`
is **required**, not defaulted: it is an exported entry point of this
package, and a permissive default would let an embedder register the
plugin with no limiter and get a §2.3.1 MUST that silently does nothing,
caught by nothing. A caller with no opinion on this budget — every
integration test exercising something else — passes
`UNLIMITED_CLIENT_SECRET_LIMITER` explicitly, which also documents at each
site that this budget is not what that test is about.

**Failures only, never successes.** `verifyClientCredentials` runs to
completion and its result returns untouched on success; only the `throw`
path calls `check`. The account lockout makes the opposite trade for the
same clause — it refuses a _correct_ password once locked, so an attacker
flooding one subject's login denies that subject their own account. This
limiter does not make that trade: a client that finally sends its real
secret always succeeds, whatever the failure count on record. The cost is
symmetric with the lockout's own — an attacker flooding one client's
`client_id` with wrong secrets can deny nothing but requests already
authenticated as _not_ that client, the same bound the lockout accepts for
subjects.

**An unknown `client_id` spends the same budget a wrong secret against a
real one does, and is refused in the same bytes — not in the same time.**
The key is the presented `client_id` itself, so nothing about which
failure occurred changes what gets counted or how the refusal reads once
the budget is spent (`429`, `Retry-After`, no body, mirroring this
throttle's own). That is as far as the claim goes: an unknown `client_id`
returns at the client lookup, before `verifyClientSecret` runs, while a
wrong secret against a real client pays the Argon2id comparison first, so
the two answer at different speeds even though their bytes and their
budget consumption match.

**That timing gap is accepted, not closed.** The tempting fix is the login
path's own: verify against a constant hash (`DUMMY_HASH`,
`packages/authn-flows/src/service/authenticators/password.ts`) when there
is no real one, so an unknown identifier costs what a wrong credential
costs. It does not transfer here. A username is secret-ish — it does not
appear on the wire outside an authentication attempt — so paying an
Argon2id verification to hide whether one exists is a cost worth paying
once per attempt. A `client_id` is not: it is plain text in every
`/authorize` URL a browser ever sees, so there is little for the timing
oracle to reveal that a redirect didn't already. Worse, a dummy hash here
would make every unauthenticated request bearing an unrecognized
`client_id` cost an Argon2id — a CPU-amplification vector reachable with no
credential at all, on an endpoint this ADR's own Context section already
treats CPU cost as the thing to protect. The per-client budget cannot
bound that amplification either: an attacker rotating `client_id`s gets a
fresh budget on each one and evicts its own history first out of the
bounded map, the same fail-open shape `MAX_THROTTLE_KEYS` chose deliberately
for the per-origin throttle. So the existence oracle stays open — low
value, given the `client_id` is not secret — and the mitigation that would
close it is worse than what it closes.

**Consequences inherited from this ADR's own reasoning, restated for the
new instance:** it is per-instance, for the reason the per-origin throttle
is (N replicas admit up to N × the budget, and `README.md` states rather
than demonstrates the limitation); it depends on nothing request-derived
being trustworthy, since the key is the request body's own `client_id`; and
`MAX_THROTTLE_KEYS`'s reasoning — a caller-chosen key is a
memory-exhaustion vector, bounded by evicting the coldest — applies to this
instance too, at its own default rather than an imported constant, since
the budget it bounds is a different one.

`docs/protocols/rfc6749.md`'s client-authentication row moves from
`deferred: P3b` to `covered`, at `RFC6749-2.3.1-04` — `docs/NEXT.md`'s own
narrative called it `deferred: P3a` before this amendment, a drift between
that file and the table this closes rather than corrects.

## Amendment, 2026-10-15 — the limiter made safe to configure, before production

Nothing above changes: the account is Postgres's, the CPU is the process's,
and the refusal is decided before anything account-dependent. What changes
is what an operator can do to the process's own memory with the settings
this ADR told them to raise, and which addresses count as one.

**One interface, two implementations.** `RateLimiter`
(`apps/server/src/rate-limiter.ts`: `check(key)` and `size()`) is all
`app.ts` depends on. `slidingWindow` stays the factory and picks
`slidingWindowLog` (the exact window above, one timestamp per admitted
request) up to `COUNTER_THRESHOLD` = 100, and `slidingWindowCounter` above
it. A shared-store limiter — GCRA or a token bucket in Redis or Postgres,
once P11 has replicas to share it between — is a third implementation
behind the same interface, and is P11's, as the per-instance limit above
already was.

**Why a counter above 100.** Measured 2026-10-13 and again 2026-10-15 on the
real limiters, 60 s window, clock frozen, 10,000 keys each spending the
whole budget. The log holds `limit` timestamps per key whatever the request
rate, since a refused request is not recorded:

| Limiter | limit |                   heap at 10,000 keys |
| ------- | ----: | ------------------------------------: |
| log     |    10 |                                3.3 MB |
| log     |   100 |                                9.8 MB |
| log     |  1000 | ~105 MB (2,000 keys measured, scaled) |
| counter |   any |                                1.9 MB |

A check costs under ten microseconds in every row. Nothing bounded
`ODUDU_THROTTLE_LIMIT` below a million, so an operator following "raise it
for a large NAT" could have asked the log for a gigabyte. 100 is the largest
limit whose log stays under about 10 MB per budget at the key cap; below it
the exact answer costs almost nothing, and above it the counter's constant
three numbers per key are worth an approximation that, at a budget that
size, is small next to the budget. The number is a judgement on those
measurements, not a knee in them. The figures exclude the key strings: the
per-origin key is under 70 bytes, but the sign-in budget's keys run to about
260 characters, which adds up to a few megabytes more per full map.

**What the counter assumes, and what that costs.** It keeps the current and
the previous fixed window's counts and estimates the trailing window as
`previous × (1 − elapsed fraction) + current`, admitting a request while that
estimate plus one is within the limit. The assumption is that the previous
window's requests were spread evenly across it. For a **steady stream** that
holds, and the estimate is within two requests of the exact count, so the
counter admits a stream two or more under the budget and refuses one two or
more over it exactly as the log does (`throttle-counter.test.ts`, a seeded
property test over 200 limits, windows and rates). For **traffic timed
against a window boundary** it does not: a burst at the end of one window
and another at the start of the next can be admitted up to just under twice
the limit inside one trailing window, and a burst early in the previous
window can make the counter refuse up to `limit` requests the log would
have admitted. Both are bounded by the limit itself, which is the right
size of error for a CPU allowance and the wrong one for a guarantee; the
budgets that guard a credential (the client secret budget and the
per-username budget, at their defaults of 5) are below the threshold and
exact. `Retry-After` for the counter is an estimate of when the
weighted count next admits a request, rounded up: never zero when refused,
and capped at one window, which can be shorter than the true wait when the
current window is already spent.

**The settings are bounded.** `ODUDU_THROTTLE_LIMIT`,
`ODUDU_CLIENT_SECRET_THROTTLE_LIMIT` and `ODUDU_LOGIN_THROTTLE_LIMIT` refuse
to boot above 10,000, naming the variable: at the default
sixty-second window, ten thousand is about 170 Argon2id verifications a
second from one origin, past what one process runs, and it is the figure at
which the exact log would have cost a gigabyte. That is the whole of the
claim: at a one-second window the same ceiling admits ten thousand a second,
so the ceiling bounds memory and is not a CPU-rate bound, which stays the
operator's to choose with the window. The windows refuse past 3,600 seconds: a
refusal telling a caller to return in over an hour is a lockout, and the
account lockout is the mechanism for that. Both bounds used to be a million
and a day; the e2e stack's 10,000 and the conformance stack's 5,000 sit
inside the new ones. `ODUDU_CLIENT_SECRET_THROTTLE_LIMIT` and
`_WINDOW_SECONDS` are new: the amendment above built that limiter at a
hard-coded five per sixty seconds and a comment naming settings nothing
read.

**IPv6 is keyed by its /64.** `request.ip` is the socket's peer address as
Fastify reports it, or, with `ODUDU_TRUST_PROXY` on, the leftmost
`X-Forwarded-For` token as the proxy wrote it — verified 2026-10-15 by
listening on `::` under Fastify 5.12.5 with trusting on and off, and
sending an IPv4 and an IPv6 peer and six spellings in the header. Findings:
a dual-stack listener reports every IPv4 peer as `::ffff:a.b.c.d`; a trusted
header passes through whatever it says, upper case, zero-expanded forms, a
zone id (`fe80::1%eth0`) and text that is no address at all; and every
spelling is a different key. Each IPv6 address was therefore its own budget,
and one home or hosting allocation is a /64 holding 2^64 addresses, so an
attacker anywhere inside it never saw a refusal. `throttleOrigin`
(`apps/server/src/throttle-origin.ts`) now keys an IPv6 address by its
first four groups, an IPv4-mapped one as the IPv4 address it carries, drops
a zone id and reads every spelling the same way; text that is no address
passes through cut to 64 characters, so a client-controlled header still
cannot grow a key. The cost is that two unrelated hosts in one /64 share
a budget, the way two behind one NAT do, and the remedy is the same
setting. An attacker holding a /56 or a /48, which is what a residential or hosting
customer is typically given, holds 256 or 65,536 /64s and so that many
budgets: the rotation defence is partial, and keying by a shorter prefix
would throttle unrelated customers of one provider together. Some forms
are reachable only through a trusted `X-Forwarded-For`, since a translator
does not sit in front of this listener: `::`, `::1`, an IPv4-compatible
`::a.b.c.d` and an SIIT `::ffff:0:a.b.c.d` all collapse to the one key
`0:0:0:0::/64`; NAT64 (`64:ff9b::/96`) collapses every embedded IPv4 address
to one key; 6to4 (`2002:aabb:ccdd::/48`) splits one site into 65,536 keys;
and Teredo clients of one server share one. None of that is new exposure —
the same header already chose the key — and all of it is accepted for the
same reason. The trust rule is unchanged: behind a proxy that appends rather
than overwrites, the key is client text and the throttle decorative.

**A second budget on sign-in, keyed by address and username.** The
per-origin budget cannot tell one account being attacked from a shared
address being busy, and the account lockout cannot refuse before it has paid
for the verification. The sign-in submission alone now also spends a budget
keyed `origin|tenant|username`, `ODUDU_LOGIN_THROTTLE_LIMIT` (default 5) per
`ODUDU_LOGIN_THROTTLE_WINDOW_SECONDS` (default 60): the lockout's five, and
half the per-origin ten, so one name cannot take an address's whole budget.
Credential stuffing against one account from one address is refused after
five, and the rest of a NAT is not touched.

It keeps the first property above intact. The username is read from the
submitted form and nothing else, so the decision cannot depend on whether
the account exists; it is folded (compatibility normalisation, trimmed,
lower-cased) so case and padding do not buy a fresh key, and cut to 128
characters with the tenant to 64, so the key set is bounded by
`MAX_THROTTLE_KEYS` like the others. It runs in `preHandler` rather than
`onRequest`, because the form is not parsed until then; that is still before
the route, so before any lookup or Argon2id verification, and it answers the
same `429`, `Retry-After` and empty body as the per-origin refusal. Tests
establish both halves: the refusal happens with the database untouched
(`app.test.ts`), and a username that is an account and one that is not
are refused in the same bytes against a real database
(`tests/throttle.int.test.ts`). A submission that names no username — the
second-factor steps carry the authentication session instead — spends
nothing here, and registration and the reset request are not covered:
neither verifies a password, and the per-origin budget still bounds them.
The second factor is bounded per account instead (below). The key is the
origin, the tenant and the folded name as a JSON array, so no tenant or
username can make two different triples one key.

The cost is a denial of service on one pair: whoever shares the victim's
address, or can choose a trusted `X-Forwarded-For`, can spend that address's
budget for that username and lock it out of signing in for a minute. A
victim on another address is unaffected, and the account lockout's own
any-origin version of this is unchanged.
Per-origin runs first, so a request the username budget refuses has already
spent an origin slot, which keeps the two within each other's bounds.

**Second-factor guessing is bounded per account, by the lockout.** The
per-origin budget bounds guesses per address, and an attacker who holds a
password has six-digit codes to find from as many addresses as they own, so
that was never a bound on the account. A wrong TOTP code, a wrong recovery
code and a replay of a code already used now each count against the same
`login_failures` row as a wrong password, under the tenant's own threshold,
doubling and ceiling (`packages/authn-flows/src/usecase/executor.ts`); the
counter moves with the same compare-and-swap the password path uses, so
guesses in parallel are all counted rather than racing under the threshold.
A correct password no longer ends the run of failures on its own: the run is
cleared when the whole sign-in that began with a password completes, so
wrong codes after a right password accumulate. A locked account refuses the
second-factor step without the code being looked at, and still counts the
attempt, as a password attempt during a lockout does; the answer is the one
a wrong code gets, so the refusal says nothing about whether a guess was
right. What is observable is only what the session already told its holder:
the account exists, because the password was right, and a recovery code on a
locked account is not hashed and so answers sooner. A replay counts because
it is a presented credential that must not work, which is the case the rule
exists for; the price is that a double-submitted correct code can leave one
failure on record when the sign-in it belonged to still completes and clears
it. A passkey assertion is not counted: a signature is not guessable, and
the step's failures are a different mechanism. The per-origin budget remains
the bound on the rate; the lockout is the bound on the account.

**A clock that steps back.** Both implementations read an injected clock. The
log caps `Retry-After` at one window, so a backward step cannot ask a caller
to wait longer than the window; the counter, after a backward step of two
windows or more, gives a key a fresh budget. Clamping to the last instant seen
would remove that and was rejected, because it would hold every window shut
for as long as an equal forward jump had lasted. Fail-open for a stepped clock
is the same posture as eviction.

**Upgrading.** The ceilings tightened from 1,000,000 requests and 86,400
seconds to 10,000 and 3,600, and the settings that were unbounded are now
checked at boot: a deployment configured above them fails to start with a
message naming the variable, and takes the new ceiling or a lower value. No
migration is involved. The project has been a hard cutover while nothing was
deployed, so this is the place the change is recorded.

**What stays per instance.** All of it. Five budgets now live in one
process's memory (origin, username, client secret and the two audit refusal
windows); each is capped at `MAX_THROTTLE_KEYS` keys, at most about 10 MB
for the exact log at its largest and 2 MB for the counter, and none touches
the database, so nothing here depends on 1,000,000 subjects, 10,000 clients
or 10,000 tenants except that the key spaces they are drawn from (origins,
usernames, client ids) are larger than the cap and evict by recency as
above. A check is a map operation and a filter over at most 100 entries, or
constant. N replicas admit N times every budget, and P11's criterion that
every in-process bound is shared or documented as multiplied by the replica
count covers these three new settings as it covers the older ones.

## Alternatives rejected

- **(a) Both halves in Postgres, keyed by origin.** Globally true, and it
  would make the limit hold across replicas for free. Rejected for what it
  costs: a write on every request to a throttled route — an `INSERT` or an
  `UPDATE`, never a read, since counting is the whole mechanism — arriving
  exactly when the database is least able to absorb it. A flood that was
  going to cost CPU instead costs write throughput on the one component the
  whole server shares, which converts a CPU-exhaustion attack into a
  database-exhaustion attack and hands the attacker leverage rather than
  taking it away. The lockout can afford a row per subject because it
  writes on _failure_, which an attacker cannot make cheap; a per-origin
  limiter writes on _arrival_, which is exactly what an attacker controls.
- **A shared cache (Redis, or Postgres `UNLOGGED`) for the window.** Holds
  globally and keeps the write off the main tables. Rejected for now
  because it adds a component ADR 0005 exists to avoid, and because it buys
  a global bound on a local resource. It is the right answer if and when
  P11's multi-replica work needs a limit that spans instances — a shared
  session cache is already on that list.
- **A maximum in `evaluatePassword` alone.** The obvious place, and
  insufficient: the login POST never calls it. Kept _in addition_ to the
  read-site cap, so the seed CLI is bound too.
- **Truncating an over-long password instead of refusing it.** Bounds the
  work and silently makes every password sharing a 256-character prefix the
  same password.
- **`preHandler` rather than `onRequest`.** Both precede the Argon2id cost,
  which is the expensive part. `onRequest` additionally precedes the body
  parse, and there is nothing in the decision that needs the body.
- **A `429` carrying a rendered page.** These three routes serve HTML to
  browsers, so a page would be friendlier. An empty body is chosen because
  the refusal must be identical for every request that reaches it, and
  rendering is where per-tenant and per-request variation creeps in.
