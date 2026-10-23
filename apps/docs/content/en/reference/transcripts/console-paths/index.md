---
title: Console paths
description: 'The routes under /console that sign an administrator in, keep the tokens on the server and forward the console’s calls, run against a stack.'
---

# Console paths

The routes under `/console` that sign an administrator in to a tenant, keep that administrator’s tokens on the server and forward the console’s calls to the admin API. The browser holds nothing but a session cookie.

Each block is a command that was run and the output it printed. The pages are in the order the requests ran, so a cookie one page sets is the one the next page sends.

How they were captured is in [How the transcripts are captured and checked](../../../contributing/transcripts.md).

## Pages

- [GET /console/auth/login](./get-consoleauthlogin.md)
- [The tenant's own sign-in](./the-tenants-own-sign-in.md)
- [GET /console/auth/callback](./get-consoleauthcallback.md)
- [The gateway is a confidential client](./the-gateway-is-a-confidential-client.md)
- [GET /console/auth/callback, refused](./get-consoleauthcallback-refused.md)
- [GET /console/auth/callback, restarted](./get-consoleauthcallback-restarted.md)
- [GET /console/api/session](./get-consoleapisession.md)
- [GET /console/api/tenants/{tenant}/discovery, GET…](./get-consoleapitenantstenantdiscovery-get-consoleapitenantstenantjwks.md)
- [GET /console/api/admin/tenants/{tenant}/subjects](./get-consoleapiadmintenantstenantsubjects.md)
- [PATCH /console/api/admin/tenants/{tenant}/subjects/{id}](./patch-consoleapiadmintenantstenantsubjectsid.md)
- [POST …/subjects, refused as cross-site](./post-consoleapiadmintenantstenantsubjects-refused-as-cross-site.md)
- [POST …/subjects, refused for another principal](./post-consoleapiadmintenantstenantsubjects-refused-for-another-principal.md)
- [A path that escapes /admin/](./a-path-that-escapes-admin.md)
- [A refresh](./a-refresh.md)
- [A refresh that cannot take the lock](./a-refresh-that-cannot-take-the-lock.md)
- [A refresh the server refuses](./a-refresh-the-server-refuses.md)
- [POST /console/auth/logout](./post-consoleauthlogout.md)
- [Following the logout redirect](./following-the-logout-redirect.md)
- [GET /console/](./get-console.md)
- [What these runs do not show](./what-these-runs-do-not-show.md)
