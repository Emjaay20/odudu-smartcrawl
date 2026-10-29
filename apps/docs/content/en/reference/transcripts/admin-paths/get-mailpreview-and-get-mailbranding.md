---
title: 'GET /mail/preview and GET /mail/branding'
description: 'The verification mail as a tenant’s published theme dresses it, and the logo and colours it inherits. manage-tenant.'
---

# `GET /mail/preview` and `GET /mail/branding`

Both need `manage-tenant` and answer for the tenant in the path only.

- `GET /mail/preview?kind=&scheme=&locale=` answers the address-verification
  mail as an HTML document, built by the code that builds the real one, with a
  sample address and link. It shows the tenant's published theme, never a draft,
  and a tenant with none shows the default. `kind` is `verify-email`, which is
  also what a missing one means; `scheme` is `light` (also when left out) or
  `dark` and fixes the palette and logo a mail client would otherwise choose by
  its own setting; `locale` is `en` or `ar`, else the tenant's `default_locale`,
  else English. The default mark is carried as a `data:` address. The response
  is meant for a frame whose parent is the same origin: its policy allows no
  script and images only from the logo's origin, and `no-store` keeps it out of
  caches. An unknown `kind`, `scheme` or `locale` is `400`. Nothing is queued,
  saved or sent.
- `GET /mail/branding` answers what that mail inherits: for `light` and `dark`
  the nine colours (`page`, `panel`, `sunken`, `border`, `ink`, `muted`, `link`,
  `button`, `button_ink`) with a `source` of `tenant` when the published theme
  sets that scheme and `default` when Odudu's own colours are used, and the
  `logo` and `dark_logo` as `src`, `alt`, `width` and `height`, or `null`. A mail
  uses the tenant's theme only, never a client's.

## The verification mail, before and after a theme

Everything below ran in one session against a freshly built stack, in a tenant
`mail-demo` created for this page. `$ADMIN_TOKEN` is `ada`'s token from [Getting
the token](./getting-the-token.md). The tenant is created, and with no theme
published its mail takes Odudu's own colours for both schemes and carries no
logo:

```bash
curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"mail-demo","display_name":"Mail Demo"}' \
  http://localhost:3000/admin/tenants | jq -c '{name, display_name, enabled}'
```

```
{"name":"mail-demo","display_name":"Mail Demo","enabled":true}
```

```bash
P=http://localhost:3000/admin/tenants/mail-demo
```

```bash
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" $P/mail/branding
```

```
HTTP/1.1 200 OK
x-request-id: 01a18709-2da1-7b5d-bafb-527424a1f03d
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 443
Date: Thu, 29 Oct 2026 09:41:28 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"light":{"source":"default","colours":{"page":"#e7eae9","panel":"#ffffff","sunken":"#f3f5f4","border":"#d4d9d7","ink":"#161b1a","muted":"#56605d","link":"#0a6344","button":"#161b1a","button_ink":"#ffffff"}},"dark":{"source":"default","colours":{"page":"#151a19","panel":"#1c2221","sunken":"#121716","border":"#2a3230","ink":"#e4e9e7","muted":"#9ba6a2","link":"#6fd8a8","button":"#e4e9e7","button_ink":"#1c2221"}},"logo":null,"dark_logo":null}
```

The preview of that mail answers a document whose policy allows images from
`data:` addresses only, because the one image it carries is Odudu's own mark, as
a `data:` address (the second line counts them):

```bash
curl -sS -D - -o default-mail.html -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview"
grep -c 'data:image' default-mail.html
```

```
HTTP/1.1 200 OK
x-request-id: 01a18709-2db3-7c35-a8d8-191b6467e682
cache-control: no-store
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'; frame-ancestors 'self'
referrer-policy: no-referrer
x-content-type-options: nosniff
content-length: 6856
Date: Thu, 29 Oct 2026 09:41:28 GMT
Connection: keep-alive
Keep-Alive: timeout=72

1
```

### With a published theme

The theme below sets both palettes and a light and a dark logo, uploaded first
(`logo.png` and `dark-logo.png` are 96 by 32 pixel PNGs made for this page). The
mail reads the published version only, so nothing changes until it is published:

```bash
LOGO=$(curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: image/png" --data-binary @logo.png "$P/theme/assets?kind=logo" | jq -r .id)
DARK=$(curl -sS -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: image/png" --data-binary @dark-logo.png "$P/theme/assets?kind=darkLogo" | jq -r .id)
cat > mail-theme.json <<EOF
{
  "tokens": {
    "light": {
      "surfacePage": "#fff4e0", "surfacePanel": "#fffaf0", "surfaceSunken": "#f0e6d0",
      "inkPrimary": "#111111", "inkMuted": "#555555",
      "signalActive": "#ddeedd", "signalActiveInk": "#004400",
      "signalDanger": "#fde0d0", "signalDangerInk": "#802000",
      "borderStrong": "#777777", "focusRing": "#0044aa"
    },
    "dark": {
      "surfacePage": "#101010", "surfacePanel": "#181818", "surfaceSunken": "#0c0c0c",
      "inkPrimary": "#f0f0f0", "inkMuted": "#b0b0b0",
      "signalActive": "#223322", "signalActiveInk": "#aaffaa",
      "signalDanger": "#401000", "signalDangerInk": "#ffb090",
      "borderStrong": "#999999", "focusRing": "#66aaff"
    }
  },
  "assets": {
    "logo": {"assetId": "$LOGO", "alt": "Mail Demo"},
    "darkLogo": {"assetId": "$DARK", "alt": "Mail Demo"}
  }
}
EOF
```

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  --data-binary @mail-theme.json $P/theme
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" $P/mail/branding | jq -c .
curl -sS -o /dev/null -w '%{http_code}\n' -X POST -H "Authorization: Bearer $ADMIN_TOKEN" $P/theme/publish
curl -sS -D - -H "Authorization: Bearer $ADMIN_TOKEN" $P/mail/branding
```

```
200
{"light":{"source":"default","colours":{"page":"#e7eae9","panel":"#ffffff","sunken":"#f3f5f4","border":"#d4d9d7","ink":"#161b1a","muted":"#56605d","link":"#0a6344","button":"#161b1a","button_ink":"#ffffff"}},"dark":{"source":"default","colours":{"page":"#151a19","panel":"#1c2221","sunken":"#121716","border":"#2a3230","ink":"#e4e9e7","muted":"#9ba6a2","link":"#6fd8a8","button":"#e4e9e7","button_ink":"#1c2221"}},"logo":null,"dark_logo":null}
200
HTTP/1.1 200 OK
x-request-id: 01a18709-2e34-7754-94eb-750998790367
cache-control: no-store
content-type: application/json; charset=utf-8
content-length: 763
Date: Thu, 29 Oct 2026 09:41:28 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"light":{"source":"tenant","colours":{"page":"#fff4e0","panel":"#fffaf0","sunken":"#f0e6d0","border":"#777777","ink":"#111111","muted":"#555555","link":"#004400","button":"#ddeedd","button_ink":"#004400"}},"dark":{"source":"tenant","colours":{"page":"#101010","panel":"#181818","sunken":"#0c0c0c","border":"#999999","ink":"#f0f0f0","muted":"#b0b0b0","link":"#aaffaa","button":"#223322","button_ink":"#aaffaa"}},"logo":{"src":"http://localhost:3000/tenants/mail-demo/brand/f49c86eb1cd9ab9d6d375c9eca74c13a8dc49208de6ccddefcc1e76be257caba.png","alt":"Mail Demo","width":96,"height":32},"dark_logo":{"src":"http://localhost:3000/tenants/mail-demo/brand/304c618a6c375671160bac8ea026f57856c3ec071400b1f5c6eed9c83ef0413b.png","alt":"Mail Demo","width":96,"height":32}}
```

The preview is the mail itself, built by the code that builds the real one, with
a sample address and link. The light palette and logo are the default; `scheme=dark`
fixes the dark ones; the `Content-Security-Policy` allows images only from the
logo's own origin, and the response is `no-store`:

```bash
curl -sS -D - -o mail-light.html -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview"
grep -o -E '<title>[^<]*</title>|background(-color)?:#[0-9a-f]{6}|<img [^>]*>' mail-light.html | sort -u | head -8
curl -sS -o mail-dark.html -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview?scheme=dark"
grep -o -E 'background(-color)?:#[0-9a-f]{6}|<img [^>]*>' mail-dark.html | sort -u | head -8
```

```
HTTP/1.1 200 OK
x-request-id: 01a18709-2e46-7215-b776-420c0387d206
cache-control: no-store
content-type: text/html; charset=utf-8
content-security-policy: default-src 'none'; style-src 'unsafe-inline'; img-src data: http://localhost:3000; form-action 'none'; base-uri 'none'; frame-ancestors 'self'
referrer-policy: no-referrer
x-content-type-options: nosniff
content-length: 6198
Date: Thu, 29 Oct 2026 09:41:28 GMT
Connection: keep-alive
Keep-Alive: timeout=72

<img class="m-logo-dark" src="http://localhost:3000/tenants/mail-demo/brand/f49c86eb1cd9ab9d6d375c9eca74c13a8dc49208de6ccddefcc1e76be257caba.png" width="96" height="32" alt="Mail Demo" style="display:none;mso-hide:all;width:96px;height:32px;border:0;font:600 14px/32px system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#111111">
<img class="m-logo-light" src="http://localhost:3000/tenants/mail-demo/brand/f49c86eb1cd9ab9d6d375c9eca74c13a8dc49208de6ccddefcc1e76be257caba.png" width="96" height="32" alt="Mail Demo" style="display:block;width:96px;height:32px;border:0;font:600 14px/32px system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#111111">
<title>Verify your email address</title>
background-color:#ddeedd
background-color:#f0e6d0
background-color:#fff4e0
background-color:#fffaf0
<img class="m-logo-dark" src="http://localhost:3000/tenants/mail-demo/brand/304c618a6c375671160bac8ea026f57856c3ec071400b1f5c6eed9c83ef0413b.png" width="96" height="32" alt="Mail Demo" style="display:none;mso-hide:all;width:96px;height:32px;border:0;font:600 14px/32px system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#f0f0f0">
<img class="m-logo-light" src="http://localhost:3000/tenants/mail-demo/brand/304c618a6c375671160bac8ea026f57856c3ec071400b1f5c6eed9c83ef0413b.png" width="96" height="32" alt="Mail Demo" style="display:block;width:96px;height:32px;border:0;font:600 14px/32px system-ui,-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;color:#f0f0f0">
background-color:#0c0c0c
background-color:#101010
background-color:#181818
background-color:#223322
```

### The language, and what is refused

The mail's language is `locale` when it is one the mail has, else the tenant's
`default_locale`, else English. An unknown `kind`, `scheme` or `locale` is `400`:

```bash
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview?locale=ar" | grep -o -E '<html[^>]*>|<title>[^<]*</title>'
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview?kind=reset"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview?scheme=sepia"
echo
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" "$P/mail/preview?locale=xx"
echo
```

```
<html lang="ar" dir="rtl">
<title>تحقق من عنوان بريدك الإلكتروني</title>
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/kind must be equal to one of the allowed values","errors":[{"path":"kind","message":"must be equal to one of the allowed values"}],"instance":"01a18709-2e81-7513-b91b-1f683a2984c7"}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/scheme must be equal to one of the allowed values","errors":[{"path":"scheme","message":"must be equal to one of the allowed values"}],"instance":"01a18709-2e89-779e-ba52-a52e54a7bcfc"}
{"type":"about:blank","title":"Error","status":400,"detail":"querystring/locale must be equal to one of the allowed values","errors":[{"path":"locale","message":"must be equal to one of the allowed values"}],"instance":"01a18709-2e91-7f90-9d3b-33d6578c3a12"}
```
