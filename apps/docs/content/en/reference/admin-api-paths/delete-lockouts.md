---
title: 'DELETE /lockouts'
description: "Requires manage-users. Clears every subject's run of failed sign-ins, locked or still counting, as DELETE /subjects/:id/lockout clears one, and…"
---

## `DELETE /lockouts`

Requires `manage-users`. Clears every subject's run of failed sign-ins, locked
or still counting, as `DELETE /subjects/:id/lockout` clears one, and answers
how many it cleared. A subject holding an admin capability the caller does not
keeps its count and is counted under `beyond_ceiling` instead — the target
ceiling that door applies, run over the tenant as a set (ADR 0040's
amendment of 2026-09-30). One `subject.lockouts_clear` row, filed on the
tenant, carries both counts and, under `subject_ids`, the ids whose counts
it cleared, sorted, at most 100 of them, so the per-subject trail the single
door leaves is not lost; a subject left beyond the ceiling writes no refused
row of its own (ADR 0037).

Against the tenth stack, after five wrong passwords for `linus`, which lock
him, and two for `grace`, which do not:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?locked=true"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/lockout"; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/lockouts"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?locked=true"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$P/subjects/01a0ee8a-c58a-716c-96a6-edcab4ca1a70/lockout"; echo
```

```
{"items":[{"id":"01a0ee8a-c748-743d-b60e-9b0ed48221a3","type":"user","username":"linus","email":null,"enabled":true,"created_at":"2026-09-29T19:01:07.522Z"}]}
{"locked":false,"locked_until":null,"failure_count":2,"last_failure_at":"2026-09-29T19:02:52.059Z"}
{"cleared":2,"beyond_ceiling":0}
{"items":[]}
{"locked":false,"locked_until":null,"failure_count":0,"last_failure_at":null}
```

### How many one call clears

One call clears at most 10,000 subjects, in subject id order, and answers how
many are left under `remaining` (counted to 10,000 and no further), so a
tenant with more is cleared by calling again until `remaining` is `0`. The
transcript above is the tenth stack's, run on 2026-09-29 before the field
existed, so its answer lacks it; the one below is the current shape. Against
`perf-demo`, with a run of five
failures written for `grace` by `insert into login_failures`:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?locked=true"; echo
curl -sS -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$P/lockouts"; echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/subjects?locked=true"; echo
```

```
{"items":[{"id":"01a10f7d-bb83-7e78-ab4a-84756ef68b49","type":"user","username":"grace","email":null,"enabled":true,"created_at":"2026-10-06T04:34:20.673Z"}]}
{"cleared":1,"beyond_ceiling":0,"remaining":0}
{"items":[]}
```
