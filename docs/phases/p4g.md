# P4g — public release

What the phase found while building it, in the shape `docs/phases/p4e.md`
follows. The phase's argument is in
[its design](../superpowers/specs/2026-10-15-p4g-public-release-design.md)
and [its plan](../superpowers/plans/2026-10-15-p4g-public-release.md).

## Spikes

### Rspress was evaluated and dropped

Rspress 2.0.23 was run in a scratch directory on 2026-10-16 (build, base paths,
CSP inventory, search, custom home, `light-dark()`, head, sitemap, Lighthouse)
and worked: one search index, one inline script, a hashed policy with no
violation, a stock page at performance 0.99. It was chosen for a Vue-docs look
and dropped on 2026-10-19 for **adoption**: the community, the plugin and theme
ecosystem and the number of people who already know the framework are small
next to Docusaurus, and the owner's look requirement is only clean, smooth,
searchable and mobile-first. Where it differed from Docusaurus: its CSS
pipeline downlevelled `light-dark()` into a hack that ignored the theme toggle
(Docusaurus's does not, below), it injected three run-time `<style>` elements
(Docusaurus injects none), it has local search built in (Docusaurus needs a
plugin) and I recall it having LLM-oriented output built in, which I did not
verify.

### The site: Docusaurus, scratch run

2026-10-19. `@docusaurus/core`, `preset-classic`, `faster` 3.10.2 (latest
stable, published 2026-07-10; `next` 3.0.0-rc.1, `canary` 4.0.0-canary-6985),
React 19.3.0, pnpm 12.3.4, Node 24.15.0, Playwright 1.63.0 on its cached
Chromium 1217, `@lhci/cli` 0.15.1, in a scratch workspace with this
repository's `.npmrc` and `pnpm-workspace.yaml` settings. Every line is a
command that was run; `assumption:` marks what was not.

- **Install.** Node `>=20.0`; React `^18 || ^19`, `react-dom` and
  `@mdx-js/react ^3` are peers the app installs. `minimumReleaseAge` and
  `engine-strict` did not refuse it; pnpm raised `ERR_PNPM_IGNORED_BUILDS`
  until `allowBuilds` named `@swc/core` and `core-js`, both `false` (the build
  does not need either postinstall). One `react` (19.3.0), no `vite`; the
  `react` pin is by convention, since no lint holds it. `tsc --noEmit` with
  `@docusaurus/tsconfig` is clean. A late `pnpm add` left a dangling
  `node_modules` link (pnpm 12.3.4) until the lockfile was regenerated.
  `docusaurus --version` fails without a site; `docusaurus build --help`
  works.
- **Two contradictions of the Rspress-era plan, both small.** A
  `"type": "module"` package fails the build (`require.resolveWeak is not a
function`), so the docs package is CommonJS. `future: { faster: true }`
  alone is refused; `future: { v4: true }` is what selects rspack.
- **Base.** `baseUrl` is a build input and the persistent cache is keyed by
  it: five alternating builds (`/odudu/`, `/docs/`, `/odudu/`, `/docs/`, `/`)
  on one cache each emitted only their own base. The cache is **not** keyed by
  environment-driven config: `markdown.format` changed from `detect` to `mdx`
  served the old compile until `docusaurus clear`. Root-relative Markdown links
  (`/intro/`) get the base prefix and are checked.
- **Inline script and style, strict CSP.** One executable inline `<script>`
  per page (626 bytes), `application/ld+json` blocks (not executed), no
  `<style>` element, and 12 distinct `style=` values over the site plus the
  three path documents (code-block theme colours). `baseUrlIssueBanner: false`
  removes a second script and six values from `index.html`. A Chromium walk
  (mobile menu, theme toggle, search, code copy, landing) under a policy of
  `script-src` one hash, `style-src 'self'` and `style-src-attr 'unsafe-hashes'`
  with the 12 hashes reported zero violations and no external request; without
  the style hashes it reported violations. Docusaurus is not strict-CSP clean; the
  hashed design stands, smaller than the Rspress one.
- **Search.** None built in. `@easyops-cn/docusaurus-search-local` 0.55.3
  (published 2026-07-29; peers `theme-common ^2 || ^3`, React to 19) installs,
  builds one same-origin `search-index.json` (4.1 MB raw, 1.09 MB gzip over the
  unsplit documents) and a `/search/` page that the sitemap includes until
  excluded; 18 suggestions for a term, no external request. It declares no
  Docusaurus 4 range, and `hashed: true` left the index unhashed. Offline use
  with the network disabled was not run: assumption.
- **Markdown.** Under `markdown.format: 'detect'` all 1,408 fenced blocks of the
  three path documents render byte for byte (trailing newline aside); `{{ }}`
  and `{ }` are literal in `.md`; a bare `<tenant>` in prose is parsed as HTML
  and a `<script>` in prose is live; `.mdx` evaluates braces and rejects
  `<!--`. The three documents hold 32 Markdown links to files outside the docs
  plugin (`../README.md`, `adr/…`) that fail the build.
- **Build size and time.** The whole scratch site with the three documents and
  search builds in 4 to 7 s. `request-paths` is 1.38 MB of HTML (183 KB gzip),
  `admin-paths` 1.26 MB (191 KB), `console-paths` 0.29 MB (35 KB), and a page
  that size loads a 157 KB content chunk on top: 332 KB of JavaScript, so the
  split by section stays required.
- **Home.** `src/pages/index.tsx` coexists with the docs plugin at
  `routeBasePath: '/'` and keeps the navbar, search and theme toggle. For the
  image the pages plugin's `path` points at `src/image-pages`; without a page at
  `/` the image has no `index.html`, and `plugin-client-redirects` as a
  substitute adds an inline script.
- **Tokens.** The console's `tokens.css` imports by relative path and Infima's
  `--ifm-*` are set from it. All eight {system light, system dark} x {initial,
  three toggle clicks} states followed the toggle with the default
  `browserslist` (lightningcss emitted its fallbacks and was still correct) and
  with a modern one (native `light-dark()`, 82.7 KB of CSS against 90.6 KB).
  On a phone the colour toggle is in the mobile menu.
- **Head, sitemap, languages.** The theme emits `<html lang>`, title,
  description, `og:*`, canonical, `hreflang` with `x-default` and a
  `BreadcrumbList` per docs page itself; `og:type`, `og:site_name`, `og:image`
  and `twitter:image` it does not (the last two from `themeConfig.image`:
  assumption). The minifier strips attribute quotes, so tests parse HTML. The
  sitemap is absolute from `url` + `baseUrl`, per locale (the root one lists no
  `/fr/` URL). `i18n/fr/docusaurus-plugin-content-docs/current/` builds `/fr/`
  with `lang="fr"`, alternates on both languages' pages and its own index;
  untranslated pages appear in English. A `robots.txt` under `/odudu/` is not
  read by crawlers. The image build keeps canonical, `hreflang`, `og:url` and
  JSON-LD whatever the config says; a 12-line `postBuild` plugin removes them
  (verified).
- **Raw imports and fence meta.** `!!raw-loader!` fails under rspack even with
  `raw-loader` installed; `?raw` with a 6-line `configureWebpack` rule
  (`resourceQuery: /raw/, type: 'asset/source'`) renders a file outside the
  docs root byte for byte. A fence's `{run expect="…"}` builds and is not
  rendered; `title="…"` is used. A generated `.md` page in a routed directory
  needs no registration.
- **Agent copies.** `docusaurus-plugin-llms` 0.6.1 (published 2026-10-03,
  peer `@docusaurus/core ^3`) writes `llms.txt` (absolute links from the site
  address; origin-relative with `useRelativeUrls` for the image),
  `llms-full.txt` and one `.md` per page. An `.mdx` page's copy is not rendered
  (imports stay, components vanish); `llms-full.txt` leaves relative links.
- **Lighthouse, 3 runs per URL, median, mobile profile.** Against
  `docusaurus serve` (uncompressed, and it answers `/robots.txt` with HTML):
  performance 0.82, LCP 4.8 s, SEO 0.92. Against a compressing static server:
  landing performance 0.98, accessibility 1.00, best practices 1.00, SEO 1.00,
  LCP 2,332 ms, CLS 0, TBT 31 ms; stock docs pages performance 0.98 to 0.99,
  LCP 1,923 to 2,377 ms, TBT 71 to 74 ms; the unsplit `console-paths` page
  0.96, LCP 2,523 ms. Accessibility was 0.92 to 0.96 before two
  configuration fixes (`--ifm-link-decoration: underline`, `prism` themes
  `github` and `dracula`) and an opacity reveal measured as contrast 1.16, so
  the reveal is transform only. First-load JavaScript: 161.7 KB gzip on the
  landing page, 179.8 KB on a docs page, plus 16.2 KB of CSS, so the 200 KB
  budget holds. The LCP headroom on the landing page is 168 ms, the real
  Core Web Vitals risk. lhci's `startServerReadyPattern` did not match
  `docusaurus serve` and it left that server running.
- **Swizzling.** None was needed for anything above: navbar, footer, colours,
  fonts, code themes and the accessibility fixes are configuration or CSS. The
  places a swizzle would appear are the code block (inline styles, if the CSP
  is ever made strict) and `@theme/SiteMetadata`.

Not verified, carried by the plan as assumptions: offline search with the
network off, `themeConfig.image`'s tags, `staticDirectories` per target,
`llms-full.txt` link rewriting, the docs plugin ignoring `.ts` files, a Chrome
on `ubuntu-latest`, Pages compressing responses, Firefox and WebKit with
`animation-timeline`, reduced-motion computed styles re-run on this stack,
`releases/latest/download` resolving to the newest non-prerelease asset and the
PNG social image reading well in link previews.

### The site: Docusaurus, workspace run

2026-10-19. The scratch findings above repeated in a throwaway worktree of this
repository's workspace (`apps/docs-spike`, never committed), with the real
lockfile, `.npmrc`, `pnpm-workspace.yaml` and lint configuration. Node 24.15.0,
pnpm 12.3.4, TypeScript 6.0.3, Playwright 1.63.0 (Chromium 153), `@lhci/cli`
0.15.1. `verified:` is a command that was run; `assumption:` was not.

Almost everything repeated. What differs from the scratch run and from the
plan, each with the change it needs:

- **The `#/` import alias does not exist in the docs app, and the
  no-relative-imports lint does reach it.** The lint's `apps/*/src/**` glob
  covers the app, so `import styles from './index.module.css'` is an error.
  `"imports": {"#/*": "./src/*"}` in `package.json` fails the build (rspack:
  `specifier is not a valid subpath for the "exports" resolution`). Docusaurus's
  own `@site` alias works, passes the lint, and needs `"paths": {"@site/*":
["./*"]}` in the tsconfig. Plan change: pages and components import through
  `@site/src/…`, never `#/`; no change to `eslint.config.js` for this.
  verified: `eslint apps/docs-spike/docusaurus.config.ts apps/docs-spike/src`
  (clean with `@site`, one `no-restricted-imports` error with `./`).
- **Ignore lists need `.docusaurus`, and the output directory should sit under
  `dist/`.** Generated `.docusaurus/` is untracked, not git-ignored, and both
  `eslint apps/docs-spike` and `prettier --check apps/docs-spike` crawl it (29
  prettier warnings there alone); `build/` is git-ignored but linted, and an
  out dir such as `dist-pages` is neither. `--out-dir dist/pages` and
  `dist/image` ride the existing `dist` rules in `.gitignore`, `.prettierignore`
  and the eslint `**/dist/**` ignore. Plan change: `.docusaurus` joins
  `.gitignore`, `.prettierignore` and the eslint `ignores`, and the build
  scripts pass `--out-dir dist/<target>`, `lhci` writes under `dist/` too.
  verified: `docusaurus build --out-dir dist/pages` exits 0 with a nested path.
- **tsconfig and the type-aware lint need four direct dependencies and a
  `.d.ts`.** `@docusaurus/tsconfig` sets `baseUrl`, which TypeScript 6.0.3
  rejects (`TS5101`) without `"ignoreDeprecations": "6.0"`. `@theme/*`, CSS
  modules and `@docusaurus/Head` resolve only with
  `src/docusaurus-env.d.ts` holding `/// <reference types="@docusaurus/module-type-aliases" />` and the same for `@docusaurus/theme-classic`, and both
  packages, plus `@types/react` 19.3.0 and `prism-react-renderer` 2.4.1 (for
  `themes`, otherwise `no-unsafe-member-access`), must be direct dependencies
  because pnpm does not hoist them. `docusaurus.config.ts` stays out of the
  tsconfig `include`: with it in, eslint refuses (`was included by
allowDefaultProject but also was found in the project service`), because
  `apps/*/*.config.ts` is already an `allowDefaultProject` glob; type-aware
  eslint then checks it through the default project and `tsc` does not.
  verified: `tsc --noEmit -p apps/docs-spike` (clean) and the eslint command
  above (clean), after those edits.
- **`tests/docs/references.test.ts` fails on a copied document.** It globs
  `**/*.md` and resolves each relative link against the file that holds it;
  `request-paths`, `admin-paths` and `console-paths` copied into
  `content/en/` fail with 20 unresolved links (`../README.md`, `adr/…`,
  `protocols/…`, `../infra/…`). The same links fail the Docusaurus build once
  `onBrokenLinks` is `throw` (a page lists each once; 32 occurrences are
  reported while `onBrokenMarkdownLinks` is `warn`). Plan change for the task
  that moves the documents: rewrite those links to absolute repository URLs
  (they leave the docs plugin), not leave them to a lenient build.
  verified: `node_modules/.bin/vitest run --project unit tests/lint tests/docs`
  in the worktree (`references.test.ts` fails on the copies; the other two
  failures are `apps/admin-console/dist` missing, unrelated).
- **A `pnpm add` after the first install leaves dangling links, confirmed in
  this workspace.** `@docusaurus/module-type-aliases` and `prism-react-renderer`
  pointed at store paths without their peer suffix; `pnpm install` said "Lockfile
  is up to date". `git checkout pnpm-lock.yaml`, delete
  `apps/docs-spike/node_modules`, `pnpm install` repaired it. So the docs
  package goes in with every dependency in its `package.json` and one install.
  verified: `ls apps/docs-spike/node_modules/@docusaurus/module-type-aliases`
  empty before, populated after.
- **The lockfile diff is large but touches nothing existing.** 811 packages
  before, 2,026 after, none removed and none changed in version; 4,648 existing
  snapshot lines were rewritten (peer-context suffixes on `vite`, `vitest`,
  `eslint`, `playwright` entries) because the new tree adds peer contexts. A
  reviewer should expect a 20,000-line lockfile hunk.
  verified: `git diff --stat pnpm-lock.yaml` and a set comparison of the
  `packages:` keys.
- **`allowBuilds` needs exactly the two entries, and `minimumReleaseAge` and
  `engine-strict` do not refuse anything.** pnpm printed
  `ERR_PNPM_IGNORED_BUILDS` (`@swc/core@1.16.18`, `core-js@3.50.0`) until
  `'@swc/core': false` and `core-js: false` were added to `allowBuilds`; it also
  writes `<name>: set this to true or false` placeholders into
  `pnpm-workspace.yaml`, which collide with hand-written keys as duplicate
  mapping keys, so edit the file, not the placeholders. verified: `pnpm add …`
  then `pnpm install` in the worktree.
- **"No `vite`" cannot hold in this workspace**: `admin-console` already brings
  `vite@8.3.1` (two instances, before and after). What holds: the docs app adds
  no `vite` and exactly one `react` and one `react-dom`. verified:
  `ls node_modules/.pnpm | grep -E "^(react|react-dom|vite)@"` (`react@19.3.0`,
  `react-dom@19.3.0_react@19.3.0`, the two `vite@8.3.1` already present).
- **The pages plugin's `path` is set through the preset**
  (`pages: { path: … }`); adding `@docusaurus/plugin-content-pages` to
  `plugins` fails with a duplicate plugin ID. A plugin in `plugins` must be a
  function, not an object. verified: both failures hit and fixed during the run.
- **`colorMode: { respectPrefersColorScheme: true }` is required** for the
  first paint to follow the system; without it a dark-system visitor starts in
  light. verified: Playwright, below.

S1 (whole documents). verified: `docusaurus build` of the three documents as
single pages, with `markdown.format: 'detect'`, two locales: 6.5 s cold, 2.4 s
cached. HTML: `request-paths` 1,369,038 bytes (182,017 gzip), `admin-paths`
1,262,135 (191,522), `console-paths` 287,015 (34,517). All 1,408 fenced blocks
(646, 601, 161) are byte-identical to the source once each page's `.token-line`
rows are joined with newlines (script: cheerio over the built HTML); the sizes
match the scratch run. The `<tenant>`-in-prose and `<script>`-in-prose
observations were not re-run: assumption (carried).

S2 (home, tokens, motion). A CSS-module reveal (`animation-timeline: view()`
inside `@supports` and `prefers-reduced-motion: no-preference`, transform only),
the console's `tokens.css` imported by relative path from `custom.css` (a CSS
`@import`, not reached by the lint), a modern `browserslist`.

- verified: Playwright 1.63.0, Chromium 153, `reducedMotion: 'reduce'` gives
  computed `animation-name: none`; `no-preference` gives the `rise` animation,
  opacity 1 throughout. The carried assumption is now verified on this stack.
- verified: the navbar background follows `--surface-panel` in all eight
  {system light, system dark} x {initial, three toggle clicks} states (initial
  state matches the system with `respectPrefersColorScheme`; a click on a
  system-light page first stays light, then dark, light: the cycle is
  system, light, dark, so three clicks do not mean three changes).
- verified: first-load budget, gzip of every JavaScript and CSS response
  (`networkidle`): landing 148.9 KB JavaScript, docs page 166.5 KB, 14.6 KB CSS
  (search plugin not in this build), so Task 31's 200 KB holds with room.
- verified, on Playwright core 1.59.0 (see next): Firefox 148.0.2 does not
  support `animation-timeline: view()`; content is fully visible (`opacity: 1`,
  `transform: none`, no animation); WebKit 26.4 supports it and animates
  transform only with reduced motion giving `animation-name: none`. The default
  `opacity: 1` outside `@supports` is enough.
- **The cached Firefox and WebKit builds are not Playwright 1.63.0's.** 1.63.0
  wants `firefox-1543` and `webkit-2359`; the cache holds `1511` and `2272`,
  which are `playwright-core` 1.59.0's (`browsers.json`). Forcing the older
  binaries through 1.63.0 hangs (`Browser.setDefaultViewport` is rejected). The
  run used a throwaway `playwright-core@1.59.0` tarball under the scratchpad.
  Plan change: any task that runs Firefox or WebKit under Playwright 1.63.0
  (CI and local) installs those browsers first (`playwright install`), or
  is scoped to Chromium; nothing in the cache can be assumed.

S3 (search, locales). verified: `@easyops-cn/docusaurus-search-local` 0.55.3
(`hashed: true`, `language: ['en','fr']`, `docsRouteBasePath: '/'`) builds
`search-index.json` at each locale root: 4,083,051 bytes (1,078,684 gzip) for
`en` and 4,096,324 (1,080,593) for `fr`, over the three documents split as one
page each. The `fr` index repeats the untranslated English pages, so the two
languages cost twice. `hashed: true` left the filename unhashed. No external
request in the walk; 18-suggestion check not repeated. `/search/` is excluded
from both sitemaps with `ignorePatterns: ['**/search/**']` and emits
`robots: noindex, follow` itself. Pressing Enter in the search box on
`/guide/` left the URL at `/guide/` (the walk in S5); the results page works
at `/search/?q=…`. `i18n/fr/docusaurus-plugin-content-docs/current/intro.md`
builds `/fr/intro` with `<html lang=fr>`, `og:locale` `fr` with `en` alternate,
`hreflang` en, fr and x-default on both languages' pages, its own search index;
the untranslated pages appear in English under `/fr/` and are in the `fr`
sitemap. `static/robots.txt` and `static/img/favicon.svg` reach the site root
and are also copied under `/fr/` (crawlers read only the root one).
verified: `curl -H 'Accept-Language: fr' http://localhost:4302/` against
`docusaurus serve`: `200`, `lang=en`, no `Location`; Docusaurus does not
redirect on the browser's language. The same is expected of GitHub Pages, which
serves files: assumption. ADR 0043 row 8 is reworded to this layout by the task
that owns the ADR.

S4 (two bases, one source). verified: `DOCS_BASE=/odudu/ docusaurus build
--out-dir dist-pages` and `DOCS_TARGET=image docusaurus build --out-dir
dist-image`, alternated twice on the persistent cache (5.5 s and 5.2 s each
with two locales and the three documents), and once more with `docusaurus
clear` between: every absolute `href`/`src` on `<a>`, `<link>`, `<script>` and
`<img>` (325 per output, parsed, not grepped) starts with its own base, and the
`baseUrl:"…"` literal in `main.*.js` matches (`/odudu/`, `/docs/`). 10 MB on
disk each. A root-relative Markdown link `/request-paths/` becomes
`/odudu/request-paths` and `/docs/request-paths`; a Markdown link to `/nope/` is reported
as `/odudu/nope/` under `onBrokenLinks: throw`. The unresolved relative
`.md` links from the moved documents are the only absolute hrefs outside the
base (`/README.md`): they escape the base, which is the same defect as above. In
the image build the pages plugin reads `src/image-pages`, `index.html` is the
plain home (`Documentation home`) and no output file contains the landing's
text.

S5 (inline scripts and styles). verified: cheerio over every HTML file of the
two-locale, searchable build (18 pages): no `<style>` element; exactly one
executable inline `<script>` per page, but **two distinct bodies, one per
locale**, because the stored-theme key differs; 10 distinct `style=` values
(9 in the image build, 16 pages). `baseUrlIssueBanner: false` kept. Plan change
for the CSP task: the hash set holds one script hash per configured locale, and
the test recomputes them from the HTML as already planned. verified: a
Chromium walk at 390 px (landing, mobile menu, theme toggle in it, `/intro/`
code-copy, `/guide/` search typing and Enter, `/fr/intro/`, `/search/?q=`)
served by `scripts/serve.mjs`-style server under `default-src 'self';
script-src 'self' <2 hashes> 'report-sample'; style-src 'self';
style-src-attr 'unsafe-hashes' <10 hashes> 'report-sample'; img-src 'self'
data:; connect-src 'self'` reported **zero** violations and no request to
another origin; the control with `style-src-attr 'report-sample'` alone
reported 24 (inline `display: none` and the like). **The policy as the plan
words it lacks `img-src 'self' data:`**: Infima's chevron, menu and
copy-button icons are `data:image/svg+xml` backgrounds, and without it the walk
reports `img-src data` violations (27 before, 0 after). Add it to the policy.
assumption: the inventory is stable across pages and releases of 3.10.2;
Task 20's test recomputes it.

S14 (metadata, sitemap, Lighthouse, agent copies).

- (a) verified: `canonical`, `og:url`, `og:locale`, `hreflang` and the
  `BreadcrumbList` JSON-LD are absolute from `url` + `baseUrl`
  (`https://example.github.io/odudu/…` form checked with `DOCS_BASE`).
  `BreadcrumbList` appears on `request-paths` and not on the slug-`/intro` page,
  so a test must not require it on every page. Under `DOCS_TARGET=image` the
  `noindex` tag from `headTags` is present on every page and an
  about 25-line `postBuild` plugin leaves 0 canonical, 0 `hreflang`, 0 `og:url`, 0 JSON-LD
  (as an inline plugin in the config; it returns a plugin function).
- (b) verified: the landing's JSON-LD through `@docusaurus/Head` arrives intact
  in `build/index.html`.
- (c) verified: `sitemap.xml` is absolute and per locale (7 URLs; the `fr` one
  lists only `/fr/…`), without `/search/`.
- (d) verified: `lhci healthcheck` and `lhci collect && lhci assert` with
  `CHROME_PATH` set to Playwright's Chrome for Testing (macOS arm64): collect
  and assert pass 12 runs. assumption: `ubuntu-latest` finds Chrome without
  `CHROME_PATH`; not run, because no branch was pushed.
- (e) verified: `docusaurus serve` is uncompressed
  (`accept-encoding: gzip` returns no `content-encoding`) and listens on
  `localhost` only (a `127.0.0.1` request hangs). `lhci collect`, 3 runs,
  median, mobile profile: `serve` performance 0.76, LCP 4,277 ms, TBT 24 ms; a
  ~25-line gzip static server (`serve.mjs`, 404 outside the base): landing 0.98,
  LCP 2,255 ms; `/intro/` 0.99, 2,083 ms; unsplit `/console-paths/` 0.97,
  2,234 ms, TBT 134 ms; `/fr/intro/` 0.99, 2,082 ms. assumption: GitHub Pages
  compresses text responses; the first deploy's `curl -sI -H 'accept-encoding:
gzip'` settles it.
- (f) verified: accessibility, best-practices and SEO 1.00 on all four URLs,
  CLS 0, with `--ifm-link-decoration: underline` and `prism` themes `github`
  and `dracula`; `favicon: 'img/favicon.svg'` gives no 404. `static/robots.txt`
  makes `docusaurus serve` answer `/robots.txt` with the file (the scratch run
  saw HTML because none existed).
- (g) verified: `docusaurus-plugin-llms` 0.6.1 (`docsDir: 'content/en'`) writes
  `llms.txt`, `llms-full.txt` and one `.md` per page, including under `/fr/`;
  links are `https://example.github.io/odudu/intro.md` under a base and
  `/docs/intro.md` for the image (`useRelativeUrls`). An `.mdx` page's copy is
  not rendered: the `import` line stays and `{1 + 1}` is left as text.
  **The `.md` copies keep body links untouched**: `/request-paths/` is not
  base-prefixed in `intro.md` under `/odudu/`, and `llms-full.txt` keeps
  `../README.md` and `request-paths#…` as written. Plan change: agent copies
  are only as correct as the source's links, so the base-prefix and the
  absolute-URL rewrites belong to the content, not to the plugin.

### The stack and the pages: spikes

2026-10-19. Docker 29.8.2, Compose v5.6.0, the current `infra/docker/Dockerfile`
built as `odudu:spike`, Postgres 17-alpine, host port 3220, no Postgres port
published, project `odudu-spike`, removed with `down -v` (no stack of the
`odudu-try` project was touched). Each line is a command that was run unless
marked `assumption:`.

**S6, the one-file compose.** Two scratch files, `postgres` + `setup` +
`odudu`, differing only in how the roles appear.

- (a) verified: `configs: roles: content: |` with the role SQL, mounted on
  `postgres` at `/docker-entrypoint-initdb.d/01-roles.sql`, creates the file in
  the service (`docker compose exec postgres cat …`) and Postgres runs it:
  `\du` lists `odudu_app` and `odudu_svc`, `/health/ready` answers 200.
  Roles through the owner connection instead (a one-shot `roles` service,
  `psql postgres://odudu:…@postgres/odudu` with an `IF NOT EXISTS` `DO` block
  and `GRANT odudu_app TO odudu_svc`, `odudu` depending on it with
  `service_completed_successfully`) also boots the server, and re-running it is
  harmless (`NOTICE … already been granted`). Which is simpler: the `configs:`
  form is four lines on `postgres` and nothing to order, but it runs only when
  Postgres initialises an empty data directory, so it cannot serve a database
  that already exists and changing the password later does nothing; the owner
  route is a separate step of about fifteen lines in compose, and zero lines
  once `odudu init` does it through the same owner connection the server
  already uses for migrations. The `odudu` image has no `psql` and the `postgres`
  driver is bundled, not installed, so the compose form of the owner route needs
  a Postgres image to run `psql` in; only a command inside the server bundle
  avoids it. Plan change: ship the `configs:` form in the one-file compose, and
  make `init` the owner-connection path that also serves an existing database.
- (b) verified: `command: ["node","--env-file=/var/lib/odudu/quickstart.env",
"dist/main.js"]` reads a file another service wrote into a shared named
  volume, and `depends_on: setup: condition: service_completed_successfully`
  held `odudu` back until `setup` exited 0 (`ps -a`: `setup exited 0`,
  `odudu running`, `curl /health/ready` 200); `restart odudu` keeps working
  from the same volume. **Two defects the first attempt hit, both of which go
  into the plan:**
  - **A named volume on a path the image does not have is root-owned**, so the
    `odudu` user (uid 100) cannot write the file: `can't create
/var/lib/odudu/quickstart.env: Permission denied`. The runtime stage needs
    `mkdir /var/lib/odudu && chown odudu:odudu /var/lib/odudu` before
    `USER odudu`, because a new volume copies the ownership of an existing image
    path. verified: a derived image doing exactly that, rebuilt `up`, and the file
    was written.
  - **A failed redirect did not fail the `setup` service.** `sh -c` with
    `set -eu` and `{ … } > "$f"` printed the error and the script still ended
    on a successful command, so `setup` exited 0 with no file and `odudu` then
    died with `node: /var/lib/odudu/quickstart.env: not found`.
    `service_completed_successfully` only asserts the exit code, so the
    command that writes the file is a real subcommand that exits non-zero when
    it cannot, or ends with `test -s`.
- `odudu console keygen` already prints the whole line
  `ODUDU_CONSOLE_CLIENT_KEY=<base64>`; appending it as is works, prefixing it
  again produced `the key is not base64-encoded JSON` and a boot failure. The
  image's `node:24-alpine` is Node 24.21.0 (this host is 24.15.0) and prints
  two `ExperimentalWarning`s to stderr for the Web Crypto call; `NODE_NO_WARNINGS=1`
  silenced them.
- (c) verified: inside `setup`, `[ -t 0 ]` is false under `docker compose up`
  (also under `script`, so a pseudo-terminal on the caller does not give a
  service one), false under `docker compose run --rm setup` when the caller's
  stdin is not a terminal (even without `-T`), and true under
  `script -q /dev/null docker compose run --rm setup`. A human's terminal
  gives the same as `script`'s pseudo-terminal: assumption (not run in an
  interactive session here). So a prompt in `setup` is reachable only through
  `run` from a terminal, and `up` has to take every value from the
  environment.
- (d) verified on macOS (BSD `script`, Darwin arm64): `script -q /dev/null
docker compose run --rm setup` gives `tty=yes`. **The form is not portable**:
  util-linux `script` on ubuntu-latest takes the command as
  `script -q -e -c "docker compose run --rm setup" /dev/null`, and the BSD
  form there would start a shell. assumption: that ubuntu form, not run; a
  throwaway-branch run settles it, and the plan's CI step must name it, not
  the macOS one.
- (e) verified: `docker compose config` with `ODUDU_PORT` unset shows
  `published: "3000"` and `ODUDU_PUBLIC_BASE_URL: http://localhost:3000`; with
  `ODUDU_PORT=3220` both read 3220. The one variable feeds the mapping and the
  public URL; `ps` shows `5432/tcp` only for `postgres` (nothing published).

**S7, the Instrument stylesheet under the page policy.** `tokens.css` and
`fonts.css` concatenated (fonts rewritten from the `@fontsource` package paths
to `/instrument/fonts/<file>`), served from a throwaway Fastify route, linked
from the existing `renderLoginForm` page under `default-src 'none'; style-src
'self'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none';
frame-ancestors 'none'`.

- verified: Chromium (Playwright 1.63.0), light and dark: zero
  `securitypolicyviolation` events and zero console CSP messages; the
  stylesheet and `ibm-plex-sans-latin-400-normal.woff2` return 200 and
  `document.fonts.check('400 16px "IBM Plex Sans"')` is true.
- verified: `light-dark()` follows `prefers-color-scheme` through
  `--surface-page` (`rgb(231, 234, 233)` light, `rgb(21, 26, 25)` dark) and
  `--ink-primary`.
- verified: size. The stylesheet is 7,679 bytes plain and 1,581 gzip against a
  12 KB / 64 KB budget; it declares 12 `@font-face` rules (Sans and Mono, latin
  and latin-ext at 400, 500, 600) and a page that uses only the latin 400 face
  downloads one file, because `unicode-range` makes the others lazy. The
  twelve woff2 files total 206,232 bytes but are never loaded together. So no
  `latin-ext` face has to be dropped, and `font-display: swap` is already in
  `fonts.css`.
- Not covered: the base styles a real stylesheet adds (the spike appended one
  rule that uses the tokens, because the login markup has no styles of its
  own); the budget has to be re-read with them.

**S8, ICU in the bundle.** `intl-messageformat` 12.1.3 in a scratch tsup
project with `apps/server/tsup.config.ts`'s `noExternal`/`external` shape
(copied), `import en from './en.json' with { type: 'json' }`.

- verified: `npx tsup` builds `dist/main.js` (67.11 KB) in 8 ms; `node
dist/main.js` under Node 24.15.0 prints `Hello`, then `2 seconds` and
  `1 second` for the plural message; the JSON is inlined (it runs with no
  `en.json` beside it) and the bundle has no `require(` of a missing file.
- verified: `ar` with all six categories returns the right branch for
  `n` = 0 (zero), 1 (one), 2 (two), 3 (few), 11 (many), 100 (other), from
  `Intl.PluralRules`, so no locale data is bundled.
- verified: size for the console. esbuild, `--bundle --minify --platform=browser
--target=es2023`, a module that only constructs and formats an
  `IntlMessageFormat`: 33,533 bytes, **9,900 bytes gzip** (9,818 at `-9`).
  Against `tests/lint/console-phone-chunk.test.ts`: the entry is budgeted
  153,000 B on a measured 145,018 B (headroom 7,982 B) and the first load
  242,000 B on 229,800 B (headroom 12,200 B). The formatter alone is over the
  entry's headroom and inside the first-load's. Decision for P4h, which owns
  the console: either raise the entry budget by about 10 KB (6.8 per cent) with
  the reason beside it, as the file's own comment requires, or keep ICU out of
  the entry (a plural-only formatter, or a lazy chunk loaded with the first
  non-English catalogue). The server side has no such constraint: the 67 KB
  bundle above is the whole cost.

### Base images by digest

2026-10-19. Every `FROM` and `image:` under `infra/` carries `tag@sha256:`, the
index digest, so one pin serves both architectures;
`tests/lint/base-images-pinned.test.ts` keeps it so for `infra`, `examples`
and `quickstart`.

- verified: `docker buildx imagetools inspect <image> | sed -n 's/^Digest: *//p'`
  for `node:24-alpine`, `postgres:17-alpine`, `axllent/mailpit:v1.31.5`,
  `swaggerapi/swagger-ui:v5.33.0`, `nginx:1.27-alpine` and `mongo:6.0.13` gave
  the digests now in the files; the first four match the plan's values.
- The plan listed five images; the sweep found two more. `mongo:6.0.13`
  (`infra/conformance/suite-compose.yaml`) and a second `postgres:17-alpine`
  (`infra/conformance/compose.yaml`) were unpinned. The echo image in
  `compose.try.yaml` was pinned by digest alone, which Dependabot cannot read:
  verified: the Docker Hub tags API lists `42` and `latest` at that digest, so
  it is now `mendhak/http-https-echo:42@sha256:a265f5...`.
- verified: `docker build -f infra/docker/Dockerfile -t odudu:p4g-pin .` exits 0
  and `./infra/docker/smoke.sh` ends with `smoke: the console shell is
served from the image` (the asset it names is content-hashed).
- `.github/dependabot.yml` gains `docker` (`/infra/docker`,
  `/infra/conformance/proxy`) and `docker-compose` (`/infra/docker`,
  `/infra/conformance`) in one `base-images` group each, using `directories`;
  `/quickstart` joins with its compose file.

### `odudu` as a command in the image

- `/usr/local/bin/odudu` is a two-line shim over `node /app/dist/main.js`;
  `CMD` is unchanged and no `ENTRYPOINT` is added, so the node base image's
  `docker-entrypoint.sh` still wraps both.
- `ARG`/`ENV ODUDU_VERSION` (default `dev`) and the OCI `source`, `licenses`
  and `version` labels are set in the runtime stage. Built with
  `--build-arg ODUDU_VERSION=1.2.3`, `docker inspect` showed the labels and
  `echo $ODUDU_VERSION` printed `1.2.3`.
- `smoke.sh` runs `docker compose exec -T odudu odudu reap` and requires a
  JSON report; before the shim it failed at that line, after it passes.
- verified: Dependabot's compose fetcher selects files with the unanchored
  `/(docker-)?compose(-[\w]+)?(?>\.[\w-]+)?\.ya?ml/i`
  (`gh api repos/dependabot/dependabot-core/contents/docker/lib/dependabot/docker_compose/file_fetcher.rb`),
  so `suite-compose.yaml` matches on its `compose.yaml` suffix and needs no
  rename. verified: `gh api repos/dependabot/dependabot-core/contents/docker/lib/dependabot/docker/file_fetcher.rb -q .content | base64 -d | grep DOCKER_REGEXP`
  gives `DOCKER_REGEXP = /dockerfile|containerfile/i`, so the docker fetcher
  takes any name containing either word.
- The image gains `ARG ODUDU_REVISION` and the `revision` label; `compose.yaml`
  passes `${ODUDU_REVISION:-unknown}`. The `container` job sets it on its
  smoke step, and `.github/actions/image` passes it as a build arg to both jobs, both
  as `github.sha`. `smoke.sh` asserts the label. The conformance rig's own
  build is not a distributed image and is left unlabelled.
- `base-images-pinned.test.ts` now also reads `.github/**/*.{yml,yaml}`
  (`image:`, scalar `container:`, `docker://`), Dockerfile continuations,
  `Dockerfile.*` names, `COPY --from` and `RUN --mount from=`, and
  Testcontainers constructor literals, which are now pinned.

## odudu init

- verified: `node_modules/.bin/vitest run --project integration apps/server/src/cli/init.int.test.ts`:
  `CREATE ROLE ... PASSWORD $1` is refused by Postgres (utility statements take
  no bind parameters), so `init` has the server build the statement with
  `select format('CREATE ROLE odudu_svc LOGIN PASSWORD %L', $1::text)`, the
  password bound to `format()`, and runs the returned text.
- `init` refuses an existing `odudu_svc` role when `quickstart.env` is absent:
  the role's password is unknown and resetting it would break whatever uses it.
- A password comes from `ODUDU_ADMIN_PASSWORD`, else the terminal prompt when
  stdin is a terminal, else it is generated (see the quickstart compose file).
- `init` creates `odudu_svc` from a SCRAM-SHA-256 verifier computed with
  `node:crypto` (no dependency), so the plaintext never reaches
  `log_statement=ddl` or `pg_stat_statements`. verified: the integration test
  signs in as the service role through `quickstart.env`'s URL.
- Runs are serialised by `pg_advisory_lock(hashtext('odudu_init'), 0)` held on
  the owner connection, and `quickstart.env` is published by link from a
  mode-0600 temp file; verified by the two-concurrent-runs test.

## The quickstart compose file

- verified: `docker compose -f quickstart/compose.yaml up -d` with a locally
  built image (`ODUDU_PORT=3250`): `setup` exited 0 after printing the banner
  once, `odudu` was healthy, `/health/ready` answered, `/console/` answered 200,
  `ps` showed `5432/tcp` only for `postgres`, and a second `up -d` ran `setup`
  again to "already exists" with the server unharmed.
- **`stdin_open: true` with `tty: true` on `setup` makes `up` interactive.**
  Stdin is then a pseudo-terminal under `up -d` (`ls -l /proc/1/fd` shows
  `/dev/pts/0`), so `init` waited for a password nobody could type and `odudu`
  never started. Contradicts the spike line above that a prompt is reachable
  only through `run`; the compose file sets neither key, and `docker compose
run --rm setup` allocates the terminal itself. verified: `script -q
/dev/null docker compose run --rm setup` on macOS prompted for the password
  twice, refused a short one with the policy message, echoed nothing typed,
  and printed the banner without a password.
- The roles are created by `init`, not by a `configs:` script on `postgres`: a
  role created that way would make `init` refuse (`odudu_svc` exists, no
  `quickstart.env`).
- The image gains `/var/lib/odudu`, `0700`, owned by `odudu`; a named volume
  copies both. verified: `init` wrote `quickstart.env` into the fresh volume.
- `ODUDU_ADMIN_EMAIL` is read by `init` when no `--admin-email` is given.
- `base-images-pinned.test.ts` exempts the one interpolation
  `${ODUDU_IMAGE:-ghcr.io/wizzywit/odudu:<tag>}`, the project's own image.

### One command, qualified

The design's goal of one command from nothing to a signed-in console is met
as: `docker compose up -d` with no input (administrator `admin@odudu.local`,
generated password, printed once in `docker compose logs setup`), and, for a
prompt, `docker compose run --rm setup` followed by `docker compose up -d`.
Compose gives a service no terminal under `up`, so the prompt cannot belong to
the first command. verified: both sequences on a local image, sign-in with the
printed password reached the change-password page, and a later `up -d` ran
`setup` to "already exists" with exit 0. A defaulted address never conflicts
with an existing administrator; one named with `--admin-email` still does.
The compose file's image tag is the placeholder `0.0.0`, replaced by the
release when the file is published as a release asset; the lint accepts only a
semver tag there.

### NODE_ENV in the quickstart

- verified: `grep -rn "NODE_ENV" apps packages` (sources, no tests): the server
  reads `config.NODE_ENV` only in `apps/server/src/config-guard.ts`. Under
  `production` it refuses to boot without `ODUDU_APP_DATABASE_URL`, with the
  published example KEK, without `ODUDU_TLS=true`, with
  `ODUDU_ALLOW_PRIVATE_CLIENT_URLS`, and without `ODUDU_PUBLIC_BASE_URL`.
  Cookie `Secure` and the `__Host-` prefix follow `ODUDU_TLS` and the base
  URL's scheme, not `NODE_ENV`; error detail and logging do not read it.
- The quickstart sets `NODE_ENV=development` for one reason, the TLS guard: it
  is plain http on loopback. The other four guards are met or unused (the app
  URL is set, the KEK is generated, private client URLs are off, the base URL
  is set). `infra/docker/compose.yaml` sets the same value for the same reason.
  `quickstart-compose.test.ts` pins the value, the "not a production
  deployment" comment and that the file sets none of `ODUDU_TLS`,
  `ODUDU_ALLOW_PRIVATE_CLIENT_URLS`, `ODUDU_KEK`.
- With `ODUDU_ADMIN_PASSWORD` set and no email on a terminal, `init` defaults
  the address instead of asking (`init.int.test.ts`; README states it).

### The shell and the reach check

- verified: `node_modules/.bin/vitest run --project unit packages/protocol-oidc/src/view/instrument-reach.test.ts`
  before the change: four renderers built a document of their own and
  imported no shell, `passkey-enrolment-html.ts`, `recovery-codes-html.ts` and
  `update-password-html.ts` in authn-flows (each with its own `escapeHtml`) and
  console-gateway's `refusal-html.ts`; `update-password-html.ts` had no test.
  All four now call their package's `page()`; its test was added with the
  check so the check ends green.
- The shell is one `page(title, body, script, frames, locale)` in each of four
  packages, held to one text by the reach test (comments aside). `body` is the
  renderer's content only; the shell owns `<main class="page">`, the mark, the
  stylesheet and favicon links. `PageLocale` is a local structural type until
  the i18n package exists.
- `x-content-type-options: nosniff` is sent by `pageHeaders`, the console shell
  and `/console/assets/*`, and `/instrument/*`; the Instrument routes bound
  their tree at 128 entries (`maxEntries`).
- A recorded `content-security-policy` block is now also held to the other
  headers `pageHeaders` sends, to the nonce form, to `connect-src 'self'` as
  the only directive beside a script, and to `frame-src` as bare origins.
- axe in the browser covers the sign-in form, the throttle page and the
  console's sign-in states only. The other page kinds (consent,
  select-account, logout, registration, verification, reset, required-action,
  TOTP, passkey, recovery codes, update-password, the error pages) are
  unit-tested but not run under axe. That belongs to P4b's every-page criterion
  (design spec section 11, P4b row: "every such page passes WCAG 2.2 AA under
  axe in both colour schemes"), which already names it, so nothing is added to
  a list.
- Recorded page documents are held to their bytes and to `page()` by
  `tests/docs/page-documents-transcripts.test.ts`; a block showing part of a
  document says so with a `…` line in it. Fix round: the console refusal
  transcripts at the `/console/auth/callback` section were stale and are
  recaptured (a first refusal restarts, a second inside the minute answers the
  page).

## Increment 13b: ui_locales parked, negotiated per page, discovery

- `ui_locales` is parked as `uiLocales` in `pending_request`, a jsonb column,
  so no migration (nothing touches a large table) and the restart link rebuilds
  it beside `prompt` and `max_age`. Parked tags are only those matching
  `[A-Za-z0-9-]{1,35}`, at most sixteen, deduplicated; the strict `isValidLocale`
  shape and the lookup are `negotiateLocale`'s. A tag outside the shipped list
  never reaches `<html lang>` or `Content-Language`: output is always an entry
  of the supported list.
- The language is negotiated before a renderer runs. `negotiatePageLocale`
  (`@odudu/i18n`, every input optional, never throws) is the one helper. Every
  `render*` takes a trailing `locale` and hands it to its package's `page()`,
  which writes `<html lang dir>`; `Content-Language` is `page.locale.tag`.
  `tests/lint/page-routes-negotiate-locale.test.ts` fails on a route call to a
  renderer that does not end with a locale. Pages with a parked request
  negotiate through `continuation()` (`ui_locales`, then the subject's `locale`,
  then `Accept-Language`); every other page (authorize error, logout, throttle,
  account pages, console refusal) negotiates on `Accept-Language` alone.
- ADR 0043 step 2: `users.locale` exists, and `continuation()` reads it
  through `subjectLocale` once a subject is known: required-action pages
  (first factor verified) pass their subject, consent after login and the
  reuse path pass `'authenticated'`. The login form, the account chooser and
  the refusal page never pass a subject. A required-action page re-rendered
  before the flow is finished falls back to `ui_locales`/`Accept-Language`,
  since the session reports no finished authentication yet.
- ADR 0043 step 3: the tenant default is `null` everywhere. P4b's row names
  it ("a tenant's supported-locales list, default locale and per-locale
  message overrides"); the helper already accepts `tenantDefault`.
- `SHIPPED_LOCALES` (`@odudu/i18n`) feeds negotiation and discovery.
  `tests/lint/shipped-locales.test.ts` finds every module that calls
  `createCatalogue`, requires its exports' `locales` to include `en` and to be
  within `SHIPPED_LOCALES`, and requires every shipped tag to be held once any
  catalogue exists, so increment 14 only has to export its catalogue.
- `createCatalogue` refuses a message containing a tag (`<b>`), `Accept-Language`
  keeps an entry whose parameter is not `q`, `parseUiLocales` reads lazily.
- `execute-actions.int.test.ts` asserted the page carried no `href`, which the
  Instrument shell's stylesheet link broke; it now asserts no anchor.
- `content-language: en` was added to every recorded page header block in the
  three guides (22), and `ui_locales_supported` to the discovery transcripts.
- Fix round 2: every renderer's `locale` is required (a forgotten argument no
  longer compiles; the lint still checks provenance); `subjectLocale` has an
  integration test (`ui-locales-subject.int.test.ts`) with a foreign-tenant
  probe; `pageHeaders` also refuses a `dir` outside `ltr`/`rtl`. Left as is:
  `required-action-response.ts` resolves the authenticated subject itself for
  the recovery-codes gate and `continuation()` takes the subject it is handed,
  so no page asks twice for the same thing today; fold them if increments 14 to
  16 add a per-page lookup.

## Increment 14: protocol-oidc page text in a catalogue

- The catalogue is `packages/protocol-oidc/src/view/messages.ts` (a flat record
  `en`, built with `createCatalogue`), not `catalogue/en.json` as the plan said:
  the text is TypeScript so a renderer's `t` id is checked by `tsc`. `t` is
  plain text (a title the shell escapes, a test); `tHtml` is escaped markup, and
  the values it is given in `isolated` are wrapped in `<bdi>` after `escapeHtml`.
  A user value reaches a message only as a marker the escaped result is searched
  for, so the message is escaped once and each user value once.
- A French catalogue exists in tests only (`withFrench`, `FRENCH` and `ARABIC` in
  `@odudu/testkit/i18n`, shared by every package): a renderer test mocks `#/view/messages`
  with `withFrench`, so the real renderer is the one rendering French.
  `SHIPPED_LOCALES` stays `en`.
- The English text is byte-identical to before except three things, each one
  re-recorded in `apps/docs/content/en/reference/transcripts/request-paths/`: user-controlled values sit in
  `<bdi>`, an apostrophe in a page's own text is `&#39;` (the catalogue is
  escaped as a whole, not trusted), and the passkey script reads its three
  sentences from `data-` attributes of its form (`data-failed` carries
  `{reason}`, which the script replaces with the browser's own reason).
  The redirect-refused logout sentence lost a hard line break. A plural uses
  ICU, so `Try again in 1,000 seconds` would now carry a thousands separator.
- The login refusal constants are catalogue ids; `refusalMessage` returns an id
  and the page formats it. The page is still no oracle: one id per step.
- Literals that stay: the protocol `error_description` an authorization error
  passes through (`outcome.description`) and the `415` media-type sentence are
  developer-facing under ADR 0043 and are isolated in `<bdi>`, not translated;
  the `·` between a client's links; the `<small>` error code; a value attribute
  that echoes the username (an attribute is its own isolation).
- Password-policy sentences: the kernel's `PASSWORD_TOO_LONG.message` and the
  rule messages in `packages/domain-identity/src/service/password-policy.ts`
  (lines 55 to 110) stay developer-facing English, because domain packages hold
  no catalogue. Every **view** that shows one to a person maps the rule code to
  a catalogue id of its own package, with the limit as an ICU argument
  (`error.passwordTooLong` takes `{max}`). protocol-oidc does it now
  (`routes/login.ts`, `routes/required-action.ts`); the other sites are named in
  the plan under Tasks 15, 16 and 17c.
- The passkey script swaps `{reason}` with a replacer function, so a browser
  reason holding `$&` is not interpreted; `throttled.retryAfter` formats with
  `::group-off`, so 3600 seconds reads `3600`, as before. The
  `page-documents-transcripts` test now renders each recorded consent, chooser,
  error, logout and throttle body back through the real renderer.

## Increment 15: authn-flows page text in a catalogue

- The helpers that read a catalogue (`t`, `tHtml`, `bdi`, the marker that keeps
  a user value out of the ICU string) moved from protocol-oidc to
  `createTranslators` in `@odudu/i18n`, which takes the calling package's own
  `escapeHtml`: authn-flows cannot import protocol-oidc, and account and
  console-gateway need the same thing next. Each package still has its own
  `messages.ts` holding its `en` record and exporting `catalogue`;
  `tests/lint/shipped-locales.test.ts` now finds a catalogue built by
  `createTranslators` as well as `createCatalogue`.
- Violations of the password policy are `{ rule, message, minLength? }`
  (`schema/password-violation.ts`): `rule` is the domain's code and picks the
  catalogue entry, `message` is the developer sentence shown (isolated) only for
  a rule this build has no entry for, `minLength` is the number the minimum
  sentence states. The superseded-password sentence is the `superseded` rule
  (`SUPERSEDED_PASSWORD`), so one page lists every sentence it can show.
  `PASSWORD_TOO_LONG` is passed as it is and read by its code (`max-length`).
- The reason a required-action page is shown again is a code
  (`EnrolmentRefusal`: `code_mismatch`, `codes_not_saved`, `passkey_not_added`),
  not a sentence, so protocol-oidc's usecase holds no English any more.
- Secrets and codes (key URI, key, recovery codes) print inside
  `<bdi dir="ltr"><code>`; the hidden `secret` field and every escaping are as
  they were. The passkey page's script reads its two sentences from
  `data-failed` and `data-cancelled` on its form, as the sign-in script does.
- `update-password-html.test.ts` already existed; it now asserts the action
  the form posts to, the title, `<bdi>` for an unknown rule, escaping, and every
  rule in a French fixture.
- The English markup is byte-identical except `<bdi dir="ltr">` around the three
  token kinds and the two `data-` attributes on the passkey form; an apostrophe
  in a page's own text would be `&#39;`, and none of these pages has one.
- The passkey sign-in script (protocol-oidc) and the passkey enrolment script
  (authn-flows) each hold the `{reason}` placeholder and the
  `form.dataset.failed.replace(...)` line. Two packages cannot share a script
  string without a package both may import and that owns markup, which does not
  exist (`kernel` is transport-free, `i18n` holds no markup); each is pinned by
  its own `vm` test.
- The French fixture helpers (`withFrench`, `FRENCH`, `ARABIC`) are in
  `@odudu/testkit/i18n`; `tests/lint/shared-fr-catalogue.test.ts` fails on a
  package that keeps a copy.

## Increment 16: account and console-gateway page text in a catalogue

- Fifteen account renderers (registration 3, verification 2, reset 8, required
  actions 2) and the console-gateway refusal page now read their text from
  `packages/account/src/view/messages.ts` (60 entries) and
  `packages/console-gateway/src/view/messages.ts` (3). Entries per package so
  far, counted with `Object.keys(en).length`: protocol-oidc 57, authn-flows 39,
  account 60, console-gateway 3: 159, before mail templates. Catalogues are TS,
  as in increments 14 and 15, not `catalogue/en.json`.
- Account routes no longer pass sentences to a page. A refusal is a code
  (`RegistrationRefusal`, `ResetRequestRefusal`) and a password rule is a
  `PasswordViolation` read by its code, the same mapping authn-flows has; the
  account views keep their own copy of the rule list (`password-rules.ts`)
  because a view may not import another package's internals. `register`,
  `completePasswordReset` and `completeRequiredActions` add `minLength` to the
  minimum-length violation (`service/password-violations.ts`);
  `PASSWORD_TOO_LONG` is passed as it is and read by its `max-length` code.
- An actions link's page lists actions by code, not by label: `peekActionToken`
  returns `actions` and `completeRequiredActions` returns `remaining` as
  `LinkedRequiredAction` codes, and the page words each from its catalogue. The
  mail still builds its list with `actionLabel`, which moves with the mail
  templates.
- `sendVerificationHtml` sends `content-language` through `pageHeaders`
  (tested against a real reply); the refusal page is tested through `sendPage`
  for the Instrument link and `Content-Language: en`.
- The registration form shows neither the tenant's display name nor an entered
  email, so there is nothing there to isolate; the tenant name appears only in
  the escaped form action.
- Reset-request enumeration: the response for a known and an unknown address is
  byte-identical, headers included, in `en`, `fr` and a negotiated mixed
  header (`reset-password.int.test.ts`).
- English markup differs only by `&#39;` for an apostrophe in a page's own text
  (`Can&#39;t create this account`, `we&#39;ve sent`, `This link can&#39;t be
used`); the required-actions, registration success and form pages are
  byte-identical. Recorded transcripts changed in 11 lines and were checked
  against a live run on the project `odudu-p4g-16`.
- `tests/docs/page-documents-transcripts.test.ts` now renders back the recorded
  account and refusal pages; `tests/docs/password-policy.test.ts` reads the
  recorded violation sentences from the real renderers instead of a regular
  expression over a route.
- Left inline in console-gateway, on purpose: the API problem-details strings in
  `view/problem.ts`, `view/api.ts`, `view/csrf-guard.ts`, `view/routes/proxy.ts`
  and `view/routes/logout.ts` (`'Unauthorized'`, `'Not Found'`, `STATUS_CODES[status]`,
  `refused as cross-site: ...`). They are RFC 9457 values for a program, not
  pages; the console words what a person reads from the problem's code. The
  server-literal lint (plan Task 17c) covers `*-html.ts` and the mail
  templates only, and its plan text now says so.
- The nine `password.rule.*` sentences exist in the account and authn-flows
  catalogues. They are pinned equal by `tests/lint/password-rule-wording.test.ts`
  rather than shared: each package's catalogue is flat and its own (ADR 0043),
  and no package both may import owns text.

## Increment 17: mail text in a catalogue, bidi controls refused in typed fields

- Mail: `packages/email/src/service/messages.ts` (15 entries, TS like the page
  catalogues; running total 174) and `templates.ts`. The mail locale is the
  recipient's `users.locale`, else the tenant default (none exists until P4b),
  else `en`, reduced to a shipped catalogue by `negotiateLocale` over
  `catalogue.locales`; an unknown or malformed tag is English. `locale` is passed
  by the self-service reset (`findByEmail`) and the admin account-email route;
  registration and the seed command have no locale to give.
- Required actions travel as codes (`action.<code>` ids); `actionLabel` is gone.
  An unknown code shows in an isolate. The link is never catalogued: a message
  names it `{link}` and the one anchor replaces a per-process token.
- Tenant name: `<bdi>` in HTML, U+2068/U+2069 in text (with bidi controls and line
  breaks stripped so it cannot close its isolate or start a line), and in the
  subject stripped of bidi controls and every C0/C1 control and U+2028/9.
- Bidi rule: the list is ADR 0043's nine code points (U+202A-202E, U+2066-2069).
  LRM, RLM and ALM are accepted because Persian and Arabic text uses them.
  Detection and the field rule live in `@odudu/contracts` (`bidi.ts`), not kernel:
  the console imports contracts and kernel carries node-only modules. Kernel adds
  `BidiControlError` and `refuseBidiControls`, the guard every repository applies.
- The admin API validates a body through `z.toJSONSchema`, which drops a `refine`,
  so the rule is a negative `regex` (a JSON Schema `pattern`); a refinement would
  have been silently unenforced there. Open-record bodies (client, tenant patch,
  settings, import) are checked in their usecases; every repository guards as a
  backstop and the problem handler answers a `BidiControlError` as a 400.
- `fieldErrorSchema` gains optional `code` (P4h generalises it to `code` and
  `params`); the first value is `bidi_control_refused`.
- Entry paths: admin subject create/patch/profile, tenant create/patch/settings/
  import (document names too), client create/patch, role and group create,
  scope create, dynamic registration, self-registration, `odudu seed` (user,
  bootstrap, profile, role, group, scope, tenant `--set display_name`, admin).
- Fields covered, on every one of those paths: username, the six name claims,
  tenant `display_name`, `client_id` (admin create and import), client `name`
  and `client_name`, role/group/client/scope `description`, scope `consent_text`
  (display text a person reads on a consent page or in a list).
- Deliberately not covered, each with its reason: email (ASCII by its CHECK),
  scope and tenant names (ASCII by their CHECKs), a dynamically registered
  client's `client_id` (generated by the server), `client_name#lang` variants
  (accepted and ignored, never stored; P4b's per-locale client metadata, ADR 0043
  row 3, applies the rule where it starts storing them), `client_uri`,
  `policy_uri`, `tos_uri` and redirect URIs (validated as URLs, shown only as
  link targets), SMTP host, username and from address and mapper and
  authenticator names (transport and registry identifiers no person reads as
  text), and SCIM (P7 builds inbound provisioning and applies the rule there).
  A confusable-character policy is P7's, per ADR 0043 row 7.
- One rule for a value a row already holds: a write that changes a value is
  refused whenever the new value holds a control; the stored value may be kept
  byte-identical, so it can be sent back with an unrelated edit and is never
  rewritten, but a legacy value cannot be edited while its control stays.
  Exporting a tenant that holds one and importing it elsewhere is refused at
  the import document schema, at the field's path (an import is a creation);
  the operator fixes the source or edits the export first. Creation is checked by the generated schema (so the
  admin API's JSON Schema enforces it); an amendment is checked by its usecase
  against the stored value, with every repository applying the same comparison
  as a backstop. The sign-in path never checks. The usecase checks stay because
  they answer a returned field outcome before any write or audit row, where the
  repository throws out of a half-done transaction; `bidi-usecases.int.test.ts`
  fails for each site if its check is deleted (mutation-checked for the role,
  group, scope, tenant, settings, subject, profile and client sites).
- `odudu seed` prints `error: <field> must not contain ...` and exits 1 for a
  refused value, with no stack.
- No Unicode normalisation form produces a control from another code point
  (checked over every code point in `bidi.test.ts`), so checking raw input is
  checking the normalised input.
- Mail transcripts were rewritten by transformation and checked against a live
  run on `odudu-p4g-17`; the admin API refusals come from the integration suite.

## Increment 17: the server literal lint

- `tests/lint/server-page-literals.test.ts` reads each `packages/*/src/view/*-html.ts`
  and `packages/email/src/service/templates.ts` as TypeScript. It reassembles text
  across concatenation and template spans, blanks `${...}` and tags, and reports
  prose in text nodes, `<script>` bodies, `alt`/`title`/`placeholder`/`aria-label`,
  the `value` of an `<input type="submit">` and a literal title passed to `page()`.
  It found nothing in the tree: every renderer was already extracted.
- Deviation from the plan text: `value` on a `<button>` is not reported. It is what
  the form submits (`value="allow"` on the consent buttons), not what the button
  says; the label is the content, which is checked as text.
- A string outside markup (a script string, a plain constant) counts only when it
  reads as a sentence or a capitalised word, since `'submit'` and `'text/html'`
  are code. Its header names that and the other things it cannot see.
- Second check: no call to `render*` or `send*Error*` in a page package's
  `*-html.ts` or `view/routes/*.ts` takes an argument holding a `.message`. It found
  one: `routes/required-action.ts` rebuilt the oversized-password violation as
  `{ rule, message: PASSWORD_TOO_LONG.message }`; it now passes the constant, as
  the account routes do, and the view maps the rule to its own catalogue entry.
- Out of scope by kind, not by allowlist: console-gateway and protocol-admin
  problem-details strings (RFC 9457 values for a program).

### Increment 17, fix round

- The lint derives its files instead of globbing `*-html.ts`: every non-test file
  under a `packages/*/src/view` (or `apps/*/src/view`) that is a `*-html.ts` or
  builds a tag, minus `messages.ts` catalogues, plus the mail templates. That
  brings in `account/view/password-rules.ts`, `authn-flows/view/refusal.ts` and
  the four `document.ts` shells; the shells' structural text and attribute names
  are not prose by the rule, so nothing is waived.
- The SMTP test mail is a mail a person receives, so it left
  `protocol-admin/src/usecase/smtp.ts` for `renderSmtpTest` in `@odudu/email`
  (`smtpTest.subject`, `smtpTest.text`, an optional locale, English today since the
  destination has no stored locale); it is in scope as part of the templates.
- Also reported now: sentences given to helper calls inside markup, `label`,
  `summary`, `aria-description`, `aria-roledescription`, `aria-valuetext`, text in
  `data-*`, unquoted attribute values and `<meta name="description">`.
- The leak check follows a local alias, a destructured `message` and a bracket
  access into a `render*` or `send*Error*` call. It does not report the deliberate
  fallback `bdi(violation.message)` in `authn-flows/view/update-password-html.ts`
  and `account/view/password-rules.ts`: a rule code with no catalogue entry shows
  the domain's sentence, isolated, rather than nothing.

## Server pages: the visual pass

Every server page took one card width (28rem, the same on every page and in every
state), the brand line, a heading, the tenant and client lines, and a visible alert
marker. Only `packages/instrument/src/pages.css` and the renderers changed; the
console's tokens and CSS did not. The stylesheet's line budget moved from 250 to 360
lines, with the byte and gzip budgets unchanged.

What was wrong: the card sized to its content (about 270px wide) and widened when an
error sentence was longer than the form; the error was a bold paragraph with no
marker; labels sat inside the focus ring; the form pages had no heading; consent's
checkbox labels broke into columns; the QR code stretched to the card; a card's last
paragraph doubled the bottom padding; a hidden passkey error showed.

Each gallery image is the page in four views: desktop light and dark (1440px,
cropped to the card) and phone light and dark (390px). Pages without the words
"renderer only" were reached on a stack by `apps/admin-console/e2e/server-pages.spec.ts`
(and `throttle-page.spec.ts`), which also holds each to axe in four theme combinations,
to the phone width and to one card width. The renderer-only ones are pinned by their
renderers' tests and by `tests/docs/page-documents-transcripts.test.ts`: the
required-actions link pages need an admin-issued link, the recovery-code form needs a
flow that includes it, and the unavailable-action page needs a deployment without a
passkey relying-party id. The 768px width was captured and looked at too; it is the
desktop layout.

- ![signin-empty](p4g-pages/signin-empty.webp) `signin-empty`: The sign-in form with a client, remember-me and the passkey option.
- ![signin-error-echo](p4g-pages/signin-error-echo.webp) `signin-error-echo`: A refused sign-in: the alert, the username given back, focus on the password.
- ![signin-long-names](p4g-pages/signin-long-names.webp) `signin-long-names`: Sign-in with a very long client name, tenant name and username (renderer only).
- ![signin-rtl](p4g-pages/signin-rtl.webp) `signin-rtl`: Sign-in under a right-to-left locale (renderer only).
- ![throttle](p4g-pages/throttle.webp) `throttle`: The too-many-attempts page.
- ![second-factor-totp](p4g-pages/second-factor-totp.webp) `second-factor-totp`: The authentication-code form with the recovery-code field.
- ![second-factor-totp-error](p4g-pages/second-factor-totp-error.webp) `second-factor-totp-error`: The same form after a wrong code.
- ![second-factor-recovery](p4g-pages/second-factor-recovery.webp) `second-factor-recovery`: The recovery-code form after an already-used code (renderer only).
- ![totp-enrolment](p4g-pages/totp-enrolment.webp) `totp-enrolment`: Authenticator enrolment with the QR code, after a wrong code.
- ![recovery-codes](p4g-pages/recovery-codes.webp) `recovery-codes`: The one-time list of recovery codes.
- ![passkey-enrolment](p4g-pages/passkey-enrolment.webp) `passkey-enrolment`: Passkey enrolment.
- ![update-password](p4g-pages/update-password.webp) `update-password`: Forced password change.
- ![update-password-violations](p4g-pages/update-password-violations.webp) `update-password-violations`: Forced password change refused, with the broken rules.
- ![required-action-unavailable](p4g-pages/required-action-unavailable.webp) `required-action-unavailable`: A pending action this deployment cannot offer (renderer only).
- ![required-actions](p4g-pages/required-actions.webp) `required-actions`: An administrator's required-actions link page (renderer only).
- ![required-actions-done](p4g-pages/required-actions-done.webp) `required-actions-done`: The page after such a link, with actions left (renderer only).
- ![consent](p4g-pages/consent.webp) `consent`: Consent with default and optional scopes.
- ![consent-long-names](p4g-pages/consent-long-names.webp) `consent-long-names`: Consent with a long client name and long unbroken scope names.
- ![consent-rtl](p4g-pages/consent-rtl.webp) `consent-rtl`: Consent under a right-to-left locale (renderer only).
- ![select-account](p4g-pages/select-account.webp) `select-account`: The account chooser with a long account name (renderer only).
- ![logout-confirm](p4g-pages/logout-confirm.webp) `logout-confirm`: Sign-out confirmation.
- ![logout-done](p4g-pages/logout-done.webp) `logout-done`: Signed out, with a front-channel logout frame.
- ![logout-redirect-refused](p4g-pages/logout-redirect-refused.webp) `logout-redirect-refused`: Signed out, the requested return address not registered.
- ![logout-no-session](p4g-pages/logout-no-session.webp) `logout-no-session`: Sign-out with no session.
- ![logout-unauthenticated](p4g-pages/logout-unauthenticated.webp) `logout-unauthenticated`: Sign-out refused: the confirmation did not match the session.
- ![error](p4g-pages/error.webp) `error`: The authorization error page.
- ![error-long](p4g-pages/error-long.webp) `error-long`: The error page with a long description and a long way-on link (renderer only).
- ![email-unverified](p4g-pages/email-unverified.webp) `email-unverified`: Sign-in refused until the address is verified.
- ![registration](p4g-pages/registration.webp) `registration`: The registration form.
- ![registration-failed](p4g-pages/registration-failed.webp) `registration-failed`: Registration refused, with the broken password rules.
- ![registration-succeeded](p4g-pages/registration-succeeded.webp) `registration-succeeded`: Account created.
- ![verification-ok](p4g-pages/verification-ok.webp) `verification-ok`: Email verified.
- ![verification-failed](p4g-pages/verification-failed.webp) `verification-failed`: A verification link that cannot be used.
- ![reset-request](p4g-pages/reset-request.webp) `reset-request`: Forgot-password request.
- ![reset-request-failed](p4g-pages/reset-request-failed.webp) `reset-request-failed`: Reset request with no address.
- ![reset-sent](p4g-pages/reset-sent.webp) `reset-sent`: Reset link sent.
- ![reset-new-password](p4g-pages/reset-new-password.webp) `reset-new-password`: Choosing a new password from a reset link.
- ![reset-weak](p4g-pages/reset-weak.webp) `reset-weak`: Reset refused, with the broken rules.
- ![reset-done](p4g-pages/reset-done.webp) `reset-done`: Password reset.
- ![reset-link-failed](p4g-pages/reset-link-failed.webp) `reset-link-failed`: A reset link that cannot be used.
- ![console-refusal](p4g-pages/console-refusal.webp) `console-refusal`: The admin console's sign-in refusal.

- verified: `docker compose` project `odudu-p4g-vis`, the image built from the branch,
  14 console screenshots (seven pages, light and dark) byte-identical before and after.
- verified: Firefox 1511 and WebKit 2272 from `playwright-core` 1.59.0, the sign-in
  with an error, consent and a long-names page at 390px in both themes: `:has()` (the
  hanging checkbox labels), `:nth-last-child(1 of :not(...))` (the trailing margin) and
  the alert marker's `content: '!' / ''` all render as in Chromium; nothing needed a
  fallback.
- assumption: Safari versions older than 15.4 lack `:has()`; there the checkbox sits
  inline before its text, which still reads.

## Increment 18: the documentation app

`apps/docs` is Docusaurus 3.10.2 with `@easyops-cn/docusaurus-search-local` 0.55.3,
built twice from one commit: `build:pages` (base from `site.config.ts`) and
`build:image` (`DOCS_TARGET=image`, base `/docs/`, noindex). The spike findings held;
what the build of the real workspace added or changed:

- verified: `pnpm add` with every dependency in one call, then the two `allowBuilds`
  entries edited over pnpm's `set this to true or false` placeholders, left no dangling
  link (`ls apps/docs/node_modules/@docusaurus/module-type-aliases` populated). The
  lockfile diff is the new importer and its tree: a comparison of the `packages:` keys
  of the second document finds 815 before, 1,876 after and none removed.
- verified: the output goes to `dist/pages` and `dist/image`, not `dist-pages`; the
  existing `dist` rules in `.gitignore`, `.prettierignore` and eslint cover them, and
  turbo's `build` output `dist/**` already names them. `.docusaurus` joins the three
  ignore lists.
- **Tests under `apps/docs/tests` cannot import by relative path** (the
  no-relative-imports lint covers `apps/*/tests/**`), and `#/` is the Docusaurus build's
  failure. `package.json` `imports` maps `#docs/*` to `./*`, which only Node, vitest
  and tsc read; nothing the bundler compiles imports through it. verified:
  `docusaurus build` with the field present, and `vitest run --project unit apps/docs`.
- **`site.config.ts` matched eslint's `apps/*/*.config.ts` default-project glob** while
  also being in the project service through the tests' import, which is a parse error.
  The glob is now `apps/*/!(site).config.ts` (comment in `eslint.config.js`).
  `docusaurus.config.ts` stays out of the tsconfig `include` for the same reason.
- verified: a plugin in TypeScript imported by the config (`plugins/image-strip.ts`,
  passed as `plugins: [imageStrip]`) replaces the planned `image-strip.js`: a CommonJS
  `.js` plugin needs `require`, which `no-require-imports` forbids.
- verified: the console's `fonts.css` imports by relative path from `custom.css`; its
  `url('@fontsource/…')` resolves from that file, so the docs app lists no font package
  and the build emits the same hashed Plex files under `assets/fonts`.
- verified: `docusaurus.config.ts`'s search options need `docsDir: 'content/en'`; without
  it the plugin warns `docsDir doesn't exist: …/docs`.
- The docs tests read `dist/`, so the root unit glob does not include them (`pnpm
test:unit` passes on a tree with no docs build). They run through the turbo `test`
  task, which depends on the build, and `pnpm --filter @odudu/docs test` in the `docs` job.
  `*.browser.test.ts` is its own vitest project (`browser`, only in the `apps/docs` scope),
  run by `pnpm --filter @odudu/docs test:browser`; the root `verify` job has no Chromium,
  so it runs in the `docs` job.
- turbo: `@odudu/docs#build` and `#test` list their inputs explicitly (the content, the
  config files and the console's `tokens.css` and `fonts.css`, which the build imports), and
  `build` names `DOCS_SITE_ORIGIN` and `DOCS_BASE` as environment. The test task depends
  on the build because the tests read `dist/`. `cross-package-reads.test.ts` lists
  `tests/support/dist.ts`.
- verified: a mutation of the colour-mode test. With `respectPrefersColorScheme: false`
  the dark-system case fails (`expected 'light' to be 'dark'`); with it on, both pass.
- Local cost of the added build: `pnpm --filter @odudu/docs build` runs both builds in 7 s on a warm install
  (cold cache each, `docusaurus clear` between). The minutes the `docs` job adds to CI are recorded from its
  first run on the pushed branch.

## The console's theme choice reaches the server pages

The console keeps a light, dark or system choice in `localStorage` and names it
on its own `<html data-theme>`. The server's pages run no script (their policy
is `default-src 'none'`), so after signing out of a console switched to light
the sign-in page followed the operating system and was dark.

- **The cookie `odudu-theme` is the carrier.** The console writes
  `odudu-theme=light|dark; Path=/; SameSite=Lax; Max-Age=31536000` (plus
  `Secure` on an https page) when a theme is chosen and expires it when the
  choice is `system`. `applyRememberedTheme` writes it on start too, so a
  stored choice made before the cookie existed reaches the pages without being
  picked again. `themeCookie` (`shared/service/theme.ts`) builds the string and
  `writeThemeCookie` (`shared/adapter/themeCookie.ts`) sets it.
- **Not a secret and not an identifier.** It holds one of two constants, is not
  `HttpOnly` (the console's script writes it), names nobody, and is read by the
  pages only to choose a stylesheet branch. It is the console's own origin, the
  one the gateway serves the pages from, so it needs no `Domain`; that holds
  because `ODUDU_PUBLIC_BASE_URL` serves both, and is not a guarantee if the
  console is ever served from another host. The browser sends it with every
  request to that origin, `/token` and the administration API included, which
  is harmless for a value that names a colour. The 8,192-character cap on the
  `Cookie` header means a person whose header is longer silently gets no theme.
  At start the console writes the cookie from the stored choice and leaves an
  existing one alone when storage cannot be read. A planted or
  stale value can only change the colour of the page it is sent to.
- **The server reads it in one place.** `pageThemeFromCookies` (`@odudu/kernel`,
  beside `pageHeaders`) takes exactly one cookie of that name whose value is
  exactly `light` or `dark`; anything else, the name twice, a header over 8,192
  characters or a value that is not text is no preference. Nothing from the
  header is ever written into markup: `page()` emits `data-theme="light"` or
  `"dark"` from a two-value allowlist. `pageHeaders` refuses a page whose
  locale carries any other theme.
- **The theme rides on the negotiated locale.** `PageLocale` gains an optional
  `theme`; `requestLocale` and `continuation` in protocol-oidc, account's
  `requestLocale` and the console gateway's refusal each pass the negotiated
  locale through `withPageTheme`, so every renderer, which already takes the
  locale last, gets it. `tests/lint/page-routes-negotiate-locale.test.ts` fails
  a route file that negotiates a page locale without `withPageTheme`.
- **No `Vary`.** Pages are `cache-control: no-store`, so no cache holds one
  to be served under a different cookie.
- **Markup is unchanged without the cookie**: no `data-theme` attribute is
  written, so the recorded documents and `page-documents-transcripts` did not
  move. The inlined brand mark is `currentColor` and follows the page. The
  favicon file `mark.svg` keeps its own `prefers-color-scheme` rule: a document
  loaded as an icon cannot read the page's attribute, and the browser's tab
  strip follows the operating system anyway.

### Increment 18, fix round

- **The image's search index was empty.** `@easyops-cn/docusaurus-search-local` skips
  any page whose `<meta name="robots">` says noindex, and the image says it on every
  page: nine documents indexed in the Pages build, none in the image. verified:
  `node -e` over `dist/image/search-index.json` before and after `forceIgnoreNoIndex:
image` (0 then 9 per index part). The test now asserts the nine sections are in each
  build's index.
- **The image bundle named the Pages host** through `siteConfig.url`, which Docusaurus
  bundles. The image's `url` is `http://localhost` (a required value no page shows: the
  canonical, `og:url` and sitemap are stripped or off), and a test greps every text file
  of `dist/image` for the Pages host. Mutation: `url: SITE_ORIGIN` for the image fails it.
  Task 18c's "a private install never names the public site" can now be held over the
  bundle as well as the HTML.
- The landing and the image home each carry `data-page` (`landing`, `docs-home`); the test
  asserts the marker's presence in the right build and its absence from every image page.
  Mutation: `pages.path` left at `src/pages` for the image fails it.
- The sidebar is asserted from a built page's menu links, in order; deleting `sidebarPath`
  fails it. The two-click walk ignores the footer, which links every section from every
  page. The colour test reads `--surface-panel` from a probe element, so a token retune does
  not fail it.
- turbo: the docs `test` inputs include `scripts/**`. verified: `turbo run test
--filter=@odudu/docs --dry=json` gives hash `b56672f34ee60e7c`, and `da10178b681bbe8a`
  after one line is appended to `scripts/serve.mjs`.
- Carried: `build:image` sets `DOCS_TARGET` inline (POSIX shell). CI is `ubuntu-latest`
  only; the manual Windows quick-start run does not build the docs. A cross-OS CI build of
  the site would need `cross-env` first. The `docs` job repeats the builds and tests that
  `verify` runs through turbo (about two builds, seconds each); its value is Chromium. The
  plan's text still says `dist-pages` and `dist-image` (D4, Task 31b, Task 35's guard b);
  the output is `dist/pages` and `dist/image`.

- **Two console tests fail when run alone under the root `dom` project.**
  `apps/admin-console/src/shared/transport/gateway.test.ts` ("refuses a path
  that would leave /console/api/") and
  `apps/admin-console/src/shared/repository/useWrite.test.tsx` ("throws a
  rejection from a plain write...") fail with an empty message under
  `vitest run --project dom <file>`, and pass under the package's own `pnpm test`,
  which is what CI runs. Confirmed unrelated to the theme work on 16cdf4e9,
  before it. Cause not found. Owner: the CI-speed task, which changes how the
  console's tests are run and has to settle one way of running them.

### Increment 18b: SEO and metadata

- The tests are `tests/seo.test.ts` (pure units), `tests/seo-html.test.ts` (both builds,
  parsed with cheerio, whose parser is parse5; the minifier drops attribute quotes) and
  `tests/seo-swap.test.ts`. They sit in `tests/` and not beside `seo.ts`: the docs scope's
  unit glob is `tests/**/*.test.ts`. `siteHeadTags()` takes no target; the head tags
  carry no address.
- verified: `themeConfig.image: 'brand/social.png'` makes the theme emit both `og:image`
  and `twitter:image`, absolute from `url` + `baseUrl` (`seo-html.test.ts`, over the
  built head). The image build sets no `image`, so it links no social image.
  `static/brand/social.png` is a flat placeholder until the mark exists.
- verified: a `<Head>` child in `src/pages/index.tsx` carries the landing's JSON-LD
  intact (`@graph` of `SoftwareApplication` and `Organization`, no `offers`); the address
  comes from `useDocusaurusContext`, because `site.config.ts` reads `process.env`, which
  does not exist in the client bundle.
- The missing-description check is `plugins/descriptions.ts`, called at the top of
  `docusaurus.config.ts` over `content/en`. verified: deleting one `description:` line
  fails `docusaurus build` with `Pages without a front-matter description:
guides/index.md`.
- The 80-word floor skips the pages listed in `tests/unfilled.json`, which are stubs until
  their increment; filling a page and deleting it from that list turns the floor on for it.
- verified: mutations, each failing the named test and passing after the restore: `<html
lang>` dropped, canonical removed, description removed (Pages); a canonical added to an
  image page and `stripForImage` bypassed (image); `url: SITE_ORIGIN` for the image (bundle
  names the Pages host).
- The swap test builds with `DOCS_SITE_ORIGIN=https://example.test DOCS_BASE=/` into a
  temporary directory (about 8 s) and asserts no file names `wizzywit.github.io`, every
  canonical, the sitemap and `robots.txt` use the new address.
- `robots.txt` is written by `plugins/robots.ts` for both builds: the image's is
  `Disallow: /`, Pages' names the sitemap. The sitemap exclusion `**/search/**` held; the
  test asserts it. The stock theme's accessibility fixes (`--ifm-link-decoration:
underline`, the prism themes) were already in place from the shell; Lighthouse is
  Task 31b's.
- turbo: `seo.ts` joins the docs build and test inputs (hash `48780ee17da6bae9` becomes
  `e716fd6beeb52b3c` after a line is appended).

### Increment 18c: readable by agents

- `docusaurus-plugin-llms` 0.6.1 is pinned exactly. verified: `pnpm view
docusaurus-plugin-llms@0.6.1 license` prints `MIT`, a dev-only dependency that no
  shipped artefact links, compatible with the AGPL-3.0 server of ADR 0042. Its
  transitive additions are `gray-matter`, `js-yaml` 3, `minimatch` 9 (the lockfile also
  re-resolved some peer suffixes).
- verified: Docusaurus runs every plugin's `postBuild` concurrently
  (`Promise.all` in `buildLocale.js`), so a second plugin cannot rewrite what the
  first writes. `plugins/agent-copies.ts` therefore wraps the plugin and runs its
  `postBuild` and then the rewrite in one function.
- verified: `docsDir` is joined to the app directory, so an absolute path finds no
  documents. `DOCS_CONTENT` (default `content/en`, a path relative to the app) lets the
  generated-page test build a docs tree with extra pages; it is a turbo `env` of the build.
- The copy of `a/index.md` is written to `a.md`, and the link rewrite maps each copy back
  to its source by trying `x.md` then `x/index.md`; a page with a front-matter `slug`
  has no such source and fails the build rather than getting a wrong rewrite.
- `llms-full.txt` shifts every heading down a level and drops each description, so its
  sections are matched to pages by order and title (the build fails if either disagrees);
  a section starts at the first `## ` after a `---` line, which a body cannot contain.
- Links in the copies: a site-absolute link gets the base (and the origin for Pages), a
  relative `.md` link is resolved against its source file and named by route, anchors and
  other hosts are untouched, code fences and inline code are skipped. A relative link to a
  non-page file is left as written. A link names the page's HTML route, not its copy.
- `MACHINE_READABLE_REFERENCES` in `nav.ts` is the hook for the generated reference: an entry
  appends a "Machine-readable references" section to `llms.txt`, and the build fails if
  the file is not written. It is empty until the reference lands in Increment 19.
- Tests: `llms.test.ts` (both builds), `llms-generated.test.ts` (a fixture generated page,
  both targets), `agent-links.test.ts`, `agent-references.test.ts`. Docusaurus builds
  from different test files take turns through a lock in `tests/support/build.ts`
  because each writes `.docusaurus`.
- verified: mutations, each red and green after the restore: a page ignored by the plugin
  (listing test, Pages), `keepFrontMatter` set (copy keeps front matter), the image built
  with `useRelativeUrls: false` (names `http://localhost`), the base dropped from a rewritten
  link (unit and generated-page tests).

### CI runs what a change can affect

ADR 0044 has the design. Findings that belong to this phase:

- **The `docs` job's timeout was a hang, not a slow build.** verified: `gh run view --job
118032200829 --log` shows `pnpm --filter @odudu/docs test` running the `browser` project
  before Chromium was installed, then `[vitest-pool]: Timeout terminating forks worker`
  and nothing more until cancellation. `afterAll` called `browser.close()` on `undefined`
  before `server.kill()`, so the `serve.mjs` child held the worker open. Reproduced
  locally with `PLAYWRIGHT_BROWSERS_PATH=/nonexistent`: the old file hung until
  killed (exit 142 from a 60 s alarm), the new one fails in under a second.
  The same hang followed `protocol-admin`'s tests at the end of the cancelled `verify`.
- The docs `test` script now runs `--project unit`; `test:browser` runs after
  Chromium is installed. The build lock in `tests/support/lock.ts` steals a lock whose
  owner is gone or that is older than its deadline, releases in `finally`, and is per
  checkout; builds have a timeout.
- verified: `ODUDU_TEST_SHARD=1/2 turbo run test --filter=@odudu/kernel` then `2/2` then
  unset give three different task hashes while `@odudu/contracts:typecheck` keeps one
  (`cache hit`); a `--shard` argument after `--` changed the typecheck hash too.
- verified: `turbo run test --affected --dry=json` with the base at `HEAD~1`, where the
  commit touched only `docs/phases/p4g.md`, lists no test task, though
  `tests/docs` reads that directory. `--affected` is not used.
- The two console dom tests the notes above recorded as failing alone did not fail on
  2026-10-19: `vitest run --project dom <both files>`, each file alone, and
  `vitest run <both files>` all passed. Left open in `docs/NEXT.md`.
- assumption: GitHub reports a skipped job as passing for a required check, and
  `actions/cache/save@v6` on an existing key warns rather than fails. Look at the first
  docs-only run and at a rerun of one commit.

### Increment 18c, fix round

- **The rewrite is tested against hand-written expectations**, one row per link form for
  both bases (`agent-links.test.ts`): inline links and images with titles, fragments and
  queries, balanced parentheses in a URL, `<...>` destinations, reference definitions, raw
  `<a href>`/`<img src>` with quoted attributes, and the forms that must be left alone
  (autolinks, other hosts, fences, inline code). Raw HTML is read one line at a time and
  only with quoted attributes; the plugin drops raw tags from its copies anyway, so a raw
  anchor does not survive into one.
- **Every reference in a copy is checked by a CommonMark parser**, `mdast-util-from-markdown`
  2.1.0 (already in the tree through Docusaurus's MDX stack; pinned directly because the
  tests import it): links, images, definitions, autolinks and raw HTML attributes must be
  fragments, external, or under the build's prefix and resolve to a file the build wrote.
  The body of a copy is compared with its source by node type and text, ignoring
  addresses, so the rewriter is not on both sides of the comparison.
- **Slugs.** A page with a front-matter `slug` has a copy named by its route, which no
  source file matches, so the build fails with `No source page for the Markdown copy`
  (tested). Authors of pages, generated ones included, must not set `slug`, a numeric
  file-name prefix, or a `dir/dir.md` index until the copy is mapped by the page's route.
- **`---js` front matter** (and any other language tag) is refused by
  `plugins/descriptions.ts`: the front-matter reader evaluates it, so the documentation
  is trusted to be authored by maintainers only. `description: ""` counts as missing and
  a file or directory starting with `_` is skipped, as Docusaurus skips it.
- **`DOCS_CONTENT`** is refused unless it names a directory under `node_modules/.cache/`
  (`plugins/content-dir.ts`), so a deploy that inherits it cannot publish a fixture.
- **Closing the stubs.** `tests/unfilled.json` is already held both ways by `ia.test.ts`.
  With `DOCS_REQUIRE_FILLED=1` a further test requires it to be `[]`; the step that closes
  the documentation sets it for the docs tests (turbo does not hash it, so that step runs
  vitest directly or with the cache bypassed).
- Smaller: `stripForImage` reads `rel` as a token list; the `llms.txt` line parser keeps a
  `]` inside a title; the seo tests assert the hreflang set exactly, the sitemap's excluded
  routes exactly, and that Pages pages carry no robots meta (the image test already asserts
  noindex on every image page).

#### Validating the CI restructure

Run on a throwaway branch with a draft pull request into the phase branch, never
`main`, with the `gate` job from this branch present. Each scenario is a push;
read the run's job list and the merge box. Nothing below has been observed yet.

1. **A prose-only line.** Append one line to `docs/NEXT.md`.
   - `changes` prints `server=false`, `buildImage=false`, `docsOnly=true`.
   - The test matrix, `trace`, `e2e`, `conformance`, `query-plans` and `container`
     show skipped. `static`, `docs`, `test-rest` (which runs only `repo-checks`),
     `verify`, `commit-messages` and `gate` are green.
   - The merge box counts the skipped required checks (`container`, `query-plans`) as
     passing. This settles whether a job-level skip satisfies a required check; until it
     is seen, keep `gate` beside the old names rather than instead of them.
2. **Code, then a move into `docs/`.** First change one line in a package source
   file and push; everything runs and `server=true`. Then, as a separate push,
   `git mv` of a package source file to a Markdown name under `docs/`.
   - `changes` still prints `server=true`, `docsOnly=false`: the old path counts.
   - The matrix, `trace`, `e2e` and the rest all run; `gate` is red for the real
     failure the move causes (the package no longer builds), not for skipping.
3. **A failing slice.** Add a failing assertion to one `protocol-oidc` test file
   and push.
   - That leg is red, and its collect and upload steps are skipped (`if: success()`);
     its "Save the Turborepo cache" step still runs.
   - The other legs finish; `trace` is skipped; `verify` and `gate` are red.
   - Revert and push: the next run restores the previous caches (`cached` counts in each
     leg's turbo summary) and is faster than the first.
4. **Also check** while those run: the Chromium step in `docs` hits its cache on the
   second run; `gate` fails when you cancel a run midway; and the Actions cache list
   holds about 14 entries per run, not hundreds.

5. **The e2e slices.** `e2e` is three legs (`e2e 1/3` to `3/3`) and one `e2e` job.
   - Wall time of the job: target 8 to 10 minutes, from 19 (run 39254678576). Read each
     leg's steps: image build under 1 minute cold, seeding about 2.3 minutes, tests
     about 5. Legs should end within a minute of each other; if one is far behind,
     count tests per leg in the log before changing anything.
   - On the second run of the same lockfile the "Build the image" step shows layers as
     `CACHED` (or `importing cache manifest`) and the `pnpm fetch` layer is not re-run;
     `container` shows the same. Only a push to main writes the cache, so a pull request's
     first run is cold until main has run once with the new Dockerfile; then the Actions
     cache list holds one `odudu-image` scope for main. Slice 1 is the slowest leg by
     about a minute: expected, not a fault. `container` fails with 'was built from' if
     the image's revision label is not the commit.
   - On a docs-only push `e2e` and the three legs are skipped; cancel one leg and
     `e2e` and `gate` go red.
   - A leg that fails uploads `playwright-report-<index>`.

Only after 1 to 3 behave as written, require `gate` on `main`, and later drop
`verify`, `container` and `query-plans` from the required list.

## Increment 19: the reference is generated from the code

`pnpm --filter @odudu/docs generate` (`apps/docs/scripts/generate.ts`) writes
the reference pages and the admin OpenAPI document; `build:pages` and
`build:image` run it first. It imports the real sources, never copies a value:
`buildAdminOpenApiDocument` and `ADMIN_ROUTES` from `@odudu/protocol-admin`, the
CLI registry and the route listing from `@odudu/server`, `configSchema` and the
error and config tables from `@odudu/kernel`, the audit vocabulary from
`@odudu/domain-audit`, the OAuth error table from `@odudu/protocol-oidc`.

- **Generated at build time, gitignored, checked for currency.** The pages go to
  `content/en/reference/generated/` and the document to `static/openapi/`, both
  in `.gitignore` and `.prettierignore`; `generated-not-committed.test.ts` holds that
  with `git check-ignore`. `generate.test.ts` regenerates in memory and compares
  every byte with the files on disk (the commit named in the banner aside), so
  tests that read a tree built from older code fail. Every page is front matter,
  then `<!-- Generated from <source> at <commit>; do not edit. -->`, then the
  renderer's output; `ODUDU_COMMIT` replaces `git rev-parse` where there is no `.git`.
- verified: `node --no-warnings scripts/generate.ts` runs under Node 24 with
  `@odudu/protocol-admin` and `@odudu/server/src/cli/registry.ts` imported by name
  (the server has no `exports`, so a deep path resolves; protocol-admin has, so
  its OpenAPI builder had to be exported from the index): `generated 24 files`, 1.3 s.
  `apps/docs/scripts/package.json` (`"type": "module"`) stops Node reparsing
  each file; the app's own package stays without it.
- verified: a Markdown link whose target is `/openapi/admin.json`, a file in `static/`, is bundled by
  Docusaurus as a hashed asset: `dist/pages/assets/files/admin-<hash>.json`, a second
  890 KB copy per target. `pathname:///openapi/admin.json` renders `href=/odudu/openapi/admin.json`
  and copies nothing. `agent-links.ts` now rewrites that form in the Markdown copies.
- verified: a docs page outside every sidebar has no sidebar and no breadcrumb, which
  `seo-html.test.ts` and `ia.test.ts` both refuse. The Reference section is therefore a
  category with `link: reference/index` and `autogenerated: reference/generated`; the
  admin API's `_category_.json` names its folder. A breadcrumb ends at the sidebar label,
  so a page does not set `sidebar_label`: its title is the label.
- The OpenAPI document has no tags and carries the capability only in prose, so a page is
  one **area** (the segment after `{tenant}`; the tenant collection, an export and an import
  are `tenants`) and an operation names its capability by the document's own `summary`.
  `$ref` to a component and the problem-details body are written once, on the index page.
- **Escaping.** In `.md` a `{x}` is text, a `<tag>` or `&entity;` is HTML, so `markdown.ts`
  turns `<`, `>` and `&` into entities outside code spans and leaves fences alone; `|`
  becomes `\|` in a table cell. `openapi-pages.test.ts` parses a hostile description with
  `mdast-util-from-markdown` and asserts it yields no HTML node.
- **Where the vocabularies live.** `ErrorCode` was a type with no runtime list: it is now
  `ERROR_CODES` and a type derived from it, and `ERROR_DOCS` is a `Record<ErrorCode, …>`, so a
  new code without a sentence is a compile error. The same holds for `CONFIG_DOCS` over
  `keyof typeof configSchema.shape`, `AUDIT_ACTION_DOCS` and the reason and event-type
  tables. Three vocabularies have no typed list in the code, so each has a registry and a test
  that reads the source and fails both ways: `ADMIN_PROBLEM_TYPES` (every `about:blank#…`
  under `protocol-admin/src/view` plus the contracts constant), `ADMIN_MUTATION_ACTIONS`
  (every `action: '<resource>.<verb>'` literal), `OAUTH_ERROR_DOCS` (typed over the
  `TokenErrorCode` union and checked against the source for the rest). An action built from a
  variable would not be seen by the second; today every route names its action as a literal.
- `git grep -n "new OduduError('" -- packages apps | wc -l` is 85 now, and the distinct codes in
  `ErrorCode` are 55.
- Defaults are read from the loader: `configReference()` runs `loadConfig` over the two required
  keys and reads what it produced, because a switch's default (`ODUDU_OUTBOX_ENABLED` is on unless
  `false`) lives in a transform that the JSON Schema of `z.toJSONSchema(configSchema, { io: 'input' })`
  cannot show; the schema gives type, bounds and enum. `config-docs.test.ts` also sets each
  default explicitly and asserts nothing changes.
- **README.** It has no environment variable table (its variables are in prose), so there is none to
  keep equal to the generated page; Increment 32 rewrites the README and links the generated page.
  Until then `tests/docs/config-defaults.test.ts` holds every "`ODUDU_X` (default `n`)" in the README
  and the two path guides to the loader's default and to a variable the loader reads.
- **The route extractor missed a route.** `tests/docs/endpoints.test.ts`'s tree parser did not match
  `└── -reset (POST)` (`/admin/tenants/:tenant/subjects/:id/password-reset`), so that route was never
  compared with the documents. It moved to `apps/server/src/served-routes.ts` (the docs generator
  needs it too) with a pattern that matches a segment starting with `-`; the documents already
  listed the route.
- turbo: `@odudu/docs#build` no longer depends on `^build` (the workspace packages it now depends on
  are read from source, and `@odudu/server`'s build is a bundle the docs do not use), takes
  `scripts/**`, `packages/*/src/**` and `apps/server/src/**` as inputs, and leaves out
  the two generated directories, which the build itself writes. `references.test.ts` skips the
  generated directory: a checkout that has not built has none, and the build checks its links.
- **Size.** Before: `dist/pages` 2,168 KB, `search-index.json` 12.3 KB (2.2 KB gzip). After:
  5,548 KB, `search-index.json` 973 KB (170 KB gzip). 22 generated pages: 986 KB of HTML, 160 KB
  gzip; the largest is admin-api/subjects (156 KB, 13.9 KB gzip; 34 operations), then clients (85 KB),
  scopes (70 KB), the CLI page (65 KB). `openapi/admin.json` is 890 KB (33 KB gzip). `llms-full.txt` is
  261 KB, the Markdown copies of `reference/` 259 KB. The search index is fetched on the first
  search, not on page load. If Task 31b's Lighthouse budget fails on subjects, split it by what
  hangs off a subject (credentials, sessions, grants) rather than loosening the budget.
- verified: mutations, each red and green after the restore. An operation dropped by the renderer
  (3 tests fail); escaping removed (the hostile-description test fails); a route removed from
  `ADMIN_ROUTES` with no regeneration (the on-disk currency test fails); a CLI option removed from
  `INIT_OPTIONS` (the on-disk test fails; the registry's own tests stay green because the help text
  derives from the same table); `ODUDU_REAP_INTERVAL_SECONDS` renamed in the schema (six
  `config-docs` tests, `config-defaults.test.ts` and the on-disk test fail, naming the variable);
  an `about:blank#…` literal removed from `keys.ts` (the problem-type test fails); a code removed from
  `ERROR_CODES` (a compile error and the code test); an audit action added without a sentence; a route
  removed from the app; an OAuth error replaced in the source.
- **`pnpm lint` needed more memory, and the cause was the docs app's typed program.** verified:
  with the generator and its tests in `apps/docs/tsconfig.json` (Docusaurus options) the typed
  program over the workspace sources was a second, unshared one, and `eslint .` ran out of heap
  (a V8 stack dump). The generator, its renderers and their tests now live under `apps/docs/scripts/`
  with their own `tsconfig.json` extending `tsconfig.base.json`; `vitest.config.ts` takes
  `scripts/**/*.test.ts` into the docs scope. `/usr/bin/time -l node_modules/.bin/eslint .` at the
  default heap passes: 4.5 GB peak resident (4.3 GB with `apps/docs` ignored), 2 min 33 s. The
  `--max-old-space-size` flag is gone from the `lint` script.

### Increment 19, fix round

- **A cached build keeps the generated pages.** `@odudu/docs#build` lists `content/en/reference/generated/**`
  and `static/openapi/**` as outputs and `ODUDU_COMMIT` as an env input (the commit the banner names). verified:
  `ODUDU_COMMIT=aaa111 pnpm turbo run build --filter=@odudu/docs` is a miss, the next run a hit, and after
  deleting both generated directories a third run is a hit that restores them (the banner still says `aaa111`);
  `ODUDU_COMMIT=bbb222` is a miss and rewrites the banners. The root `test` and `verify` scripts export it from
  `git rev-parse`. A workflow that calls `turbo` directly has to export it too (`ODUDU_COMMIT: ${{ github.sha }}`
  is one line in the `docs` job); without it the banner names the commit at generation time and a cache hit can carry
  an older one. Package tests are excluded from the inputs and the packages' `package.json` files are in.
- **Admin mutation actions are typed.** `ADMIN_MUTATION_ACTIONS` is a tuple in `domain-audit` and
  `AdminMutationInput.action` is its union, so `recordAudit`, `auditRepository.record` and the CLI refuse an unlisted
  action at typecheck. Making it compile found four the literal scan could not see: `console.assertion` and the three
  `subject.*_send` actions, whose union types span lines. `tests/docs/audit-actions.test.ts` scans every production
  source as a second check.
- **Variables outside the loader** (`ODUDU_ADMIN_EMAIL`, `ODUDU_ADMIN_PASSWORD`, `ODUDU_VERSION`) are a second table
  on the configuration page, and `tests/docs/env-reads.test.ts` fails on any `env.ODUDU_*` read in a production
  source that is neither a loader key nor in it. `requiredWhen` on five keys says what the server cannot start without
  (the console, on by default, needs `ODUDU_PUBLIC_BASE_URL` and `ODUDU_CONSOLE_CLIENT_KEY`);
  `apps/server/src/config-required.test.ts` holds each claim to its guard.
- **The endpoint listing is exact.** `buildApp` takes an `onRoute` hook, and `servingApp()` (now in
  `apps/server/src/testing/`, which the bundle never imports) builds the app with the console, a generated console
  key and a stylesheet directory, so `/console/*` and `/instrument/*` are listed. The old `printRoutes` parser is gone;
  it showed wildcards under the wrong prefix. The routes that only answer `404` for an unclaimed path under
  `/console/auth` and `/console/api`, and the CORS preflight, are `NOT_LISTED`, and the page says so. The admin
  sentence says "under `/admin`", asserted over `ADMIN_ROUTES`.
- **OAuth error codes are typed per surface.** `AUTHORIZATION_ERRORS`, `TOKEN_ERRORS`, `USERINFO_ERRORS` and
  `REGISTRATION_ERRORS` are tuples; the authorization outcomes, `errorRedirect`, the userinfo and registration
  challenges take their unions, and `surfacesOf(code)` reads where a code is answered from them. A test checks each list
  against the modules of its surface. (The earlier check searched the whole source tree for `'code'`, which a
  documentation table in the same tree satisfied.)
- **Readability.** Known patterns and formats are put in words (a UUID, an ISO 8601 date and time, no bidirectional
  control characters), a pattern the generator does not know is listed after the operation in a collapsed
  `<details>` block, plurals are right, a table that stops at the depth limit says so and links the OpenAPI document,
  and every area page ends with `Documentation coverage: n of m fields described`. Descriptions are written in
  `packages/contracts/src/admin/docs.ts`, apart from the schemas, and five request or response bodies carry an example (create client, create user,
  set required actions, a page of audit events, create tenant; settings has one too).
  `apps/docs/scripts/coverage-ratchet.test.ts` holds each area to the baseline below; an area new to the API must be added.
  The areas below 50% (`groups`, `roles`, `mail`, `smtp`, `whoami`, which share shapes with ones that are done) belong to the guides increments (24 to 27), which
  write for those areas as they describe them.

#### Admin API documentation coverage

| Area                  | Described | Fields |
| --------------------- | --------- | ------ |
| `audit`               | 60        | 60     |
| `clients`             | 277       | 288    |
| `flow`                | 12        | 12     |
| `groups`              | 16        | 67     |
| `keys`                | 30        | 31     |
| `lockouts`            | 3         | 3      |
| `mail`                | 4         | 15     |
| `registration-tokens` | 14        | 14     |
| `roles`               | 7         | 65     |
| `scopes`              | 78        | 85     |
| `sessions`            | 17        | 18     |
| `settings`            | 0         | 0      |
| `smtp`                | 5         | 24     |
| `subjects`            | 202       | 230    |
| `tenants`             | 165       | 202    |
| `whoami`              | 0         | 4      |

- The `generate.test.ts` comparison of the files on disk with a fresh generation guards a stale local tree; in CI
  the build regenerates just before the tests run, so it is not a drift check there. What keeps the reference from
  drifting is derivation, and the typed tables above.

- **Descriptions are kept out of the console's bundle.** verified: writing them with `.describe()` on the contract
  schemas took the console's first load to 246,513 B gzipped against a budget of 242,000
  (`tests/lint/console-phone-chunk.test.ts` failed), because the console imports the same schemas to validate.
  `docs.ts` holds them instead, found by field names and applied by `documentedJsonSchema` when the OpenAPI document is
  built (a shape is matched when it makes up four fifths or more of an object's fields); the console never imports it.
  The documentation packages' prose (`CONFIG_DOCS`, `ERROR_DOCS`, `ADMIN_PROBLEM_TYPES`, `OAUTH_ERROR_DOCS`, the audit
  tables) moved to a `./docs` subpath of each package for the same reason: verified by building the server, whose bundle
  carried that prose before the move and does not after (`grep` for a sentence of each in `apps/server/dist`).

## Increment 20: the documentation inside the image

`/docs` is served by `@odudu/web-assets` (`docsRoutes`, `docsPolicy`) from the built `apps/docs/dist/image`,
copied to `/app/docs`; ADR 0029's second amendment has the design.

- **Size.** verified: `du -sk /app/docs` in the image is 6,184 KB over 135 files (`dist/image`, 134 plus the
  `csp.json` the build writes), against the route's bound of 5,000 files and 64 MiB. The built site is the
  `search-index.json` (1.1 MB), `openapi/admin.json` (985 KB), `llms-full.txt` (306 KB) and the pages; it is
  read into memory once at boot, so the server holds about 6 MB more resident. The pages are not compressed
  by the server (the largest, `reference/generated/admin-api/subjects`, is 156 KB): a reverse proxy does that.
- **The runtime image was 1.26 GB before this increment and is 383 MB now, for a reason that is not the docs.**
  verified: `docker image inspect odudu-p4g-docs-odudu --format '{{.Size}}'` gave 1,262,971,531 with the docs
  stage added and the old `prod-deps` stage; `/app/node_modules/.pnpm` held 1,722 packages (788 MB: vitest,
  typescript, eslint, Docusaurus, `@rspack`, turbo). Since `pnpm fetch` is the first layer (ADR 0044), pnpm
  12.3.4 materialises the whole virtual store in `node_modules/.pnpm` and runs install scripts there; the
  later `pnpm install --prod --offline` unlinks the devDependencies from the top level and leaves their
  directories. `rm -rf node_modules` before that install takes the image to 383,096,741 bytes with 252 packages
  and none of those (`ls /app/node_modules/.pnpm | grep -cE '^(vitest|typescript|@docusaurus)'` prints 0), and
  `import('@node-rs/argon2')` still resolves from `/app`. The docs add about 6 MB of that. The old
  `odudu-e2e-odudu` image, built before the fetch layer, was 372,632,477.
- **Policy.** `dist/image/csp.json` holds 1 script hash and 7 style-attribute hashes (the seven values are listed
  in the amendment). The scratch finding (12 values, two locales) is smaller because the image has one locale
  and no landing page. verified: mutations, each failing and passing after the restore. A hash removed from
  `csp.json` fails `csp.test.ts` ("names the hash of every executable inline script and style attribute") and
  the Chromium walk (84 `style-src-attr` violations reported); an inline `<script>window.x=1</script>` added to a
  built page with `csp.json` regenerated to include it fails "exactly one executable inline script per page";
  `scripts/csp.test.ts` refuses a `<style>`, an `on*` attribute and a `javascript:` URL.
- **The walk is `scripts/csp.browser.test.ts`**, not `tests/csp.test.ts`: the root `unit` project has no Chromium, so
  it is a `*.browser.test.ts` (the `browser` glob now takes `scripts/` too) and runs where Chromium is installed, in
  the `docs` job's `test:browser` step. It sits in `scripts/` because it imports `@odudu/web-assets` and `fastify`,
  and a workspace import from `tests/` joins the Docusaurus-options program, the unshared second program that ran
  `eslint .` out of memory in Increment 19; `scripts/` extends `tsconfig.base.json` (plus the `dom` lib, for the
  callbacks `page.evaluate` runs in the page). `tests/csp.test.ts` imports no workspace package for the same reason,
  and the check that `csp.json` is accepted by the server is in `scripts/csp.test.ts`.
  It serves the image through the real `docsRoutes` on an ephemeral port, so the header under test is the one the
  server sends. It covers navigation, the colour toggle three times, a search that fetches
  `/docs/search-index.json` from the same origin, Enter in the box, code copy on the CLI reference (the first page
  with a code block; `quick-start` has none while its section is a stub), and the mobile menu with the toggle in
  it at 390 px; a last case injects a script and a style attribute and expects both violations, so a silent
  pass is not a broken listener.
- **The CLI reference names `http://localhost:3000`**, the address `odudu` serves on by default, and the build
  renders it as an anchor. `csp.test.ts` allows that one value as an absolute anchor and nothing else; the
  build's placeholder `url` (`http://localhost`, no port) is checked absent from every page and agent copy.
- **Path prefix.** The README's Deploying list says the site must sit at the root of `ODUDU_PUBLIC_BASE_URL`.
  The operating section's Deploying page (Task 27) is not written, so the ADR names the README for now; that
  page states it with its own test, as the plan's Task 27 already lists.
- **Not done here, and where it goes.** The server does not compress, which a reverse proxy
  normally does; P11's load work owns measuring it. `OPTIONS` and writes under `/docs/` answer Fastify's `404`
  without the docs headers, as `/console/*` does: they carry no document.
- **The `docs` and `container` jobs** run this on push: `docs` runs `test:browser` (the walk), `container` runs the
  smoke additions. Nothing here has been seen green in CI yet.
- **`pnpm lint` runs out of memory at Node's default heap on this machine, at the commit before this increment
  too.** verified: `pnpm lint` at `77812712` in a fresh worktree ends `FATAL ERROR: Ineffective mark-compacts near
heap limit` at 4.56 GB resident; with `NODE_OPTIONS=--max-old-space-size=8192` it passes, 5.29 GB peak, 2 min 27 s,
  and the same run on this increment passes at 5.01 GB. So the increment adds nothing measurable, and the margin
  Increment 19 recorded ("4.5 GB peak resident at the default heap passes") is gone on Node 24.15.0 and macOS arm64.
  The `static` job runs `pnpm lint` with no `NODE_OPTIONS`; whether ubuntu-latest passes is unobserved. If it does
  not, the `lint` script takes the flag back or the typed program shrinks again; that decision is the controller's.

### Increment 20, fix round

- The Chromium walk now `goto`es every built HTML page as a document (35 routes from the built tree, `404.html` through
  an unknown path), one browser and context. verified: an inline script added to `quick-start/index.html` without
  regenerating `csp.json` fails it; the same page passed the old walk.
- The policy gains `object-src 'none'` and `frame-src 'none'`; workers fall back to `default-src 'self'`.
- The docs headers are on every response the route's handlers produce. Fastify's own `400` (malformed percent-escape)
  and `404` for methods other than `GET`/`HEAD` carry none; a root hook would touch every other route, so the wording
  was narrowed instead (ADR 0029, `request-paths`).
- `scripts/csp.test.ts` fails, naming the file, on any built file whose extension is not in `DOCS_TYPES`.
- The docs routes log nothing per request (`logLevel: 'warn'` on the route); warnings and errors still print. A page
  load was about 20 info lines. Not done, kept as notes: no compression (P11), `csp.ts` does not read a `style=` inside a
  `<template>` (Docusaurus emits none), and the immutable rule is by name shape under `assets/`.
- **`lint` pins its heap.** Node's default old-space limit is about 4 GB on 64-bit (4,288 MB here, whatever the RAM
  above 16 GB), and `eslint .` peaks at 5.0 to 5.3 GB resident, so a bare run is a coin flip on GC timing. The script is
  `node --max-old-space-size=6144 node_modules/eslint/bin/eslint.js .`, cross-platform, so local, `pnpm verify` and CI
  agree; 8192 would not be backed by a 7 GB runner. Shrinking the Docusaurus-options typed program is the longer-term fix.

## Recovery-code lifecycle

Recovery codes had a creation path and a spend path and nothing in between: an administrator could remove a TOTP
enrolment and leave the set that stood in for it, so a re-enrolment silently revived codes that may have left with the
lost device. This increment gives the set a lifecycle. The concept page for the docs site is the "Recovery codes"
section of `concepts/sessions.md` (Increment 25); this section is its source.

### Recovery codes

- **What a recovery code is for.** It stands in for a TOTP code at the second-factor step, once. It is not itself a
  factor at all, so a subject whose only "factor" is a set of codes has none.
- **What a recovery code stands in for: a TOTP, and only a TOTP.** The login accepts a code only at the TOTP code step
  (`recoveryApplicable`, which now also needs the subject to hold a TOTP, whatever the tenant's `otpRequired` says of
  others), and never after a passkey. So `recoveryStanding.hasTotp` counts `totp` rows alone. Consequences, all tested
  through `advance`: removing the last TOTP revokes the set even while a passkey remains; passkey enrolment owes no set
  (ADR 0021's amendment, dated 2026-10-19); a surviving code offered beside a password by a subject with no TOTP is
  neither accepted nor spent, with `otpRequired` on or off and a passkey held or not. With `otpRequired` on, a
  passkey-only subject signs in with the passkey, where the code step does not apply, as before, and a subject with
  neither owes `configure-totp`; before this round a surviving code was offered to such a subject as the second factor.
  The earlier reading, that a passkey is a factor a set protects, was wrong and is superseded.
- **Removal.** `onSecondFactorRemoved` (`@odudu/authn-flows`) runs after a TOTP or passkey row is deleted, in the same
  transaction and with the subject row locked (`FOR NO KEY UPDATE`, as every admin mutation takes it). With no second
  factor left it deletes the whole set, spent rows included, and records `subject.recovery_codes_revoke` with
  `{revoked, reason: "last_factor_removed"}`; with a TOTP left, or no codes held, it writes nothing. It also completes an
  owed `generate-recovery-codes` whenever no TOTP remains. The only path that
  removes a second-factor row today is the admin API's `deleteCredential` (verified: `grep -rn "deleteOne" packages apps
--include='*.ts'` finds that one caller; password-history trimming and `deleteRecoveryCodes` are the other deletes).
  P4f's self-service removal calls the same function.
- **Admin revoke.** `DELETE …/recovery-codes?require_new_set=true|false`, default true. With a TOTP remaining
  and the flag true it adds `generate-recovery-codes` in the same transaction; with no TOTP remaining nothing is added
  whatever the flag says. The audit detail is `{revoked, new_set_required}`.
- **Sign-in check.** After a sign-in completes (every factor satisfied, not merely the first), a subject who holds a
  TOTP and no unspent code owes `generate-recovery-codes`. One aggregate query (`recoveryStanding`) on the
  success path; the action is only added, and `completeRecoveryCodes` clears it once a set exists, so it cannot loop.
  It does not run for a password-only stage, so a password alone earns no prompt about a factor it did not present.
- **Owner notice.** `renderSecondFactorRemoved` and `renderRecoveryCodesRevoked` in `@odudu/email`, queued through the
  outbox in the admin transaction. The rule: sent to the address on file, verified or not, because the message carries no
  link, code or factor detail and an unverified address learns nothing from it; skipped without a trace when the subject
  has no address; none for a revoke that found no code. The tenant name goes through the catalogue's isolate and subject
  cleaning like every other mail.
- **Ending sessions.** The per-subject end exists (`DELETE …/sessions`), so the console's removal dialog offers
  "Also end the subject's sessions" when the factor is the last one. Unticked by default: whether the factor was lost or
  stolen is something only the operator knows, and the dialog says so. The two calls are separate; if the second fails
  after the first succeeded the dialog reports the failure and the tab shows what the server holds.
- **Confirmed unchanged.** First enrolment issues a set (`recovery-codes.int.test.ts`, "owes generate-recovery-codes to a
  subject who has just enrolled TOTP"), regenerating replaces the old ten (same file, "replaces the whole set when a
  subject generates again"), and wrong recovery codes count toward the second-factor lockout (`second-factor-lockout.int.test.ts`,
  "wrong recovery codes count too"), so nothing needed adding for those.
- **A behaviour change worth knowing.** A subject with a TOTP and no codes, which is every subject enrolled before codes
  existed and every one revoked with `require_new_set=false`, is now asked for a set at their next sign-in. That is the
  point; one existing integration test (`subjects.int.test.ts`, the TOTP removal) seeded such a subject and now seeds a
  saved code, the state an ordinary enrolment leaves.
- **Issuing is serialised with removal.** `beginRecoveryCodes` takes the subject row lock (`subjectRepository.lock`, which
  `lockSubjectRow` in protocol-admin now delegates to) and issues only while a TOTP is held; otherwise it clears
  the owed `generate-recovery-codes` action and answers `{kind: 'no_second_factor'}`, which both page doors turn into the
  expired-sign-in page. A set therefore never exists for a subject with no factor. verified: the interleaving test in
  `recovery-lifecycle.int.test.ts` ("never leaves a set behind a removed last factor") holds the issuing transaction open
  while the removal starts on a second connection; removing the lock from `beginRecoveryCodes` fails it.
- **End sessions is part of the removal.** `DELETE …/credentials/{id}?end_sessions=true` calls `endAllSessions` inside the
  removal's transaction (`DeleteCredentialDeps.endSessions`, injected because the sessions usecase imports the subjects
  one), needs `manage-sessions` too, and records `detail.ended_sessions` on `subject.credential_delete`. The console makes
  one request.

### What NIST requires of look-up secrets

Read directly from the SP 800-63B-4 pages on 2026-10-19 (`https://pages.nist.gov/800-63-4/sp800-63b/authenticators/`
and `…/events/`), paraphrased:

- **§3.1.2.1, the authenticator.** Generated with an approved random bit generator; delivered securely, and when
  delivered online, within a session authenticated at AAL2 or higher; at least six decimal digits or equivalent.
- **§3.1.2.2, the verifier.** Prompts for a secret; accepts each secret successfully once; stores them hashed with an
  approved function; a secret under 112 bits is salted (salt at least 32 bits) and hashed with a password hashing
  scheme, and the verifier rate-limits failed attempts on the account (§3.2.2's bound is 100 consecutive failures).
- **§4.3 and §4.5, compromise and invalidation.** Lost, stolen or duplicated authenticators are compromised and are
  invalidated promptly; invalidation is also owed when the subscriber asks and when the account ceases to exist.
- **§4.1.2.1 and §4.6, notice.** An added authenticator is notified through a channel independent of the binding; events
  that change authenticators trigger notices to the addresses on file, with instructions for someone who did not do it;
  issuing a replacement recovery code set is one of them (§4.2).

Where Odudu stands: ten characters from a 32-character alphabet are 50 bits, far over the floor, drawn from
`node:crypto` `randomBytes`; each is Argon2id-hashed with its own salt (the same parameters as a password), so the
under-112-bit rule is met; single use is a conditional `UPDATE`; failures count against the tenant's second-factor
lockout, whose threshold is a tenant setting that a CHECK holds to at most 100 and that defaults to 5; the codes page is reached only through a
completed sign-in. Revocation on compromise was the gap (an operator could not tell the server a factor was lost without
orphaning its set), now closed by the removal rule; the notice for an administrator's change is added here (to the address on file, verified or not, since
it carries nothing a stranger could use). Not met, and
placed: a notice when the subject's own enrolment or regeneration changes their authenticators, which is **P4f** (the
design spec's P4f criterion and `apps/docs/content/en/roadmap.md`'s "What is not implemented" now name it).

- verified: `cd packages/authn-flows && ../../node_modules/.bin/vitest run --config ../../vitest.config.ts tests/recovery-lifecycle.int.test.ts`
  (12 tests) and the same from `packages/protocol-admin` with its own `tests/recovery-lifecycle.int.test.ts` (10 tests),
  both against real PostgreSQL; the console's Chromium run, `subjects.spec.ts` on the stack `odudu-p4g-recovery`, 15 passed.
- Mutations, each failing the named test and passing after the restore: dropping the second-factor condition from
  `onSecondFactorRemoved` ("keeps the set while a passkey remains"); dropping it from the sign-in check ("owes nothing
  to a subject with no second factor"); removing the sign-in call from `advance` (three tests); counting a passkey as a factor again
  ("revokes the set with the last TOTP even while a passkey remains"); ignoring `require_new_set` in the
  handler ("owes nothing when require_new_set is false"); owing a set with no factor left ("owes nothing to a subject
  with no second factor"); letting the executor offer the code step for a subject with no TOTP ("is neither accepted nor spent");
  mailing a revoke that found nothing ("writes no mail when no code was held").

### Fix round 2

- A passkey is not what a set protects; see "What a recovery code stands in for" above. The unverified-address rule has a
  cost the P4f row now names: self-registration with somebody else's address can make an administrator's notice mail a
  stranger the tenant name and the fact that an account exists.
- `removeCredentialQuerySchema` and `revokeRecoveryCodesQuerySchema` are strict, so `DELETE …/credentials/{id}` now
  refuses an unknown query parameter with `400` where it used to ignore one. admin-paths says so.

### The docs footer, reworked

2026-10-19. The stock footer (dark rail surface, nine links in one column, a lone
"Project" column, a centred licence line) was taller than the content above it on
the image's home page at 2000 px. It is now one hairline-topped row on the page
surface (`--surface-panel`, `--border`, `--ink-muted`), content in the same
`.container` as the pages: the licence on the left, five links on the right
(Quick start, Reference, Security, Contributing, GitHub; `FOOTER_ROUTES` in
`nav.ts`). Configuration and CSS only, no swizzle, no inline style. Under 997 px
the licence drops below the links; at 576 px the links are a two-column grid with
44 px targets (32 px on a desktop; WCAG 2.2 asks for 24). GitHub carries
`rel="noopener noreferrer"` and a visually hidden "(opens in a new tab)", written
as a footer `html` item because the theme's own icon has an `aria-label` on an
`svg` with no role, which a screen reader may skip.

![The footer before, desktop dark](p4g-docs/footer-before-desktop-dark.webp)
![The footer after, desktop dark](p4g-docs/footer-after-desktop-dark.webp)
![The footer before, phone light](p4g-docs/footer-before-phone-light.webp)
![The footer after, phone light](p4g-docs/footer-after-phone-light.webp)

- **The year is the build's.** `© {new Date().getUTCFullYear()}` is computed in
  `docusaurus.config.ts`. A build after New Year changes it, and the turbo cache
  keys (`@odudu/docs#build` inputs and `env`) do not include the date, so a
  cached build from December survives into January until a source file changes.
  turbo's `env` takes names, not expressions, so the year cannot be made an input
  without a wrapper that exports it; not done. A cache hit can therefore carry the
  previous year. `tests/footer.test.ts` fails on a stale
  build, which is the signal to rebuild.
- **Tests.** `tests/footer.test.ts` (both builds: footer on every page, year,
  link targets exist, repository link attributes and cue, no `style` attribute,
  no hosted address in the image) and `tests/footer.browser.test.ts` (axe on the
  footer in both targets and both schemes, home and a docs page; no horizontal
  scroll and 24 px targets at 1440, 768 and 390; surface equals the navbar's).
  `axe-core` and `@axe-core/playwright` 4.13.0 became docs devDependencies, the
  versions the console already pins.
- verified: `pnpm --filter @odudu/docs build:image`, `build:pages`, then
  `test` (209 passed) and `test:browser` (19 passed, the image CSP walk
  among them); screenshots by Playwright Chromium at 1440, 768 and 390, light
  and dark, home and `/reference/`.

## The mail shell

2026-10-19. Every mail was `<p>` tags and a link: the owner's complaint was that it
looked nothing like the pages or the console. Every mail kind now goes through one
shell, `renderShell` in `packages/email/src/service/shell.ts` (verification, password
reset, required-actions link, the second-factor-removed and recovery-codes-revoked
notices, the SMTP test). A grep of the six `render…` names finds every call site, and
`outboxRepository(...).enqueue` and `sender.send` are the only two doors a message leaves by.

- **Layout.** Presentation tables (`role="presentation"`), 560px at most, a ghost table for
  Outlook's Word engine, `table-layout: fixed`, every style inline, a system font stack
  with no family name that contains a space (the server literal lint reads one as a
  sentence), no script, no remote stylesheet, no `url()`, no web font. A name or an address
  with no break opportunity wraps (`overflow-wrap: anywhere`) instead of widening the page:
  checked in Chromium at 600, 375 and 320px for every kind, including a 300-character name.
- **Header.** The tenant's display name beside the Odudu mark (controller ruling: the
  tenant is the sender identity; `odudu` is a quiet signature). Powered-by and the year are
  in the footer, as muted text with no link. The mail does not name a client: no flow that
  sends a mail carries one today, so there is nothing to put in a body.
- **Button.** The label comes from the catalogue (`Verify email`, `Reset password`,
  `Update account`); the padding is on the cell (12px 24px around a 20px line is 44px),
  with `mso-padding-alt` for Outlook, no VML. The same address is written out under it in
  a monospace box, `word-break: break-all`, as an anchor with the whole link; the
  plain-text part has the link on a line of its own. A link that is not an absolute
  `http(s)` URL is refused (`RangeError`), so `javascript:` cannot reach an `href`; the check
  lives in `renderShell` itself and also refuses credentials in the URL, surrounding whitespace
  and control characters. `+` and `%2F` in a link reach the href, the shown text and the
  plain text unchanged (`shell.test.ts`).
- **Footer.** The reason the mail was sent, per kind, then `© {year} Odudu · Powered by
odudu`. The year is the UTC year of an injected `now`, required everywhere (the account
  usecase and route deps, `ActionLinkTenant`, the credential-notice input, the SMTP test
  message; `systemClock` is passed only at the composition root). Tested with a fixed clock
  at 2026-12-31T23:59:59Z, 2027-01-01T00:00:00Z and 2031-06-01 against the queued row's
  footer year for verification (`verify-email.int.test.ts`), registration and reset (through
  their routes, `register.int.test.ts`, `reset-password.int.test.ts`), required actions
  (`execute-actions.int.test.ts`), `deleteCredential`, `revokeRecoveryCodes` and
  `enqueueCredentialNotice` (`recovery-lifecycle.int.test.ts`) and `sendTestMessage`
  (`smtp.test.ts`); replacing `now` with `new Date()` in each of those usecases fails its test.
  What is not tested: the protocol-admin routes' own `now: deps.now()` argument. A token
  minted on a fake clock is refused by the server, so a year cannot be forced through
  HTTP there; typecheck is what holds it (the input requires `now`). The plain-text part ends
  the same way after a `--` line.
- **A retried mail keeps the year it was queued in.** The markup is rendered when the row is
  written, not when it is sent, so a message retried after New Year says the year it was queued.
- **Preview text.** A hidden first element of the body (`display:none`, `max-height:0`,
  `overflow:hidden`, `mso-hide:all`, page-coloured, then a run of zero-width and no-break
  spaces so the client does not append body text), one sentence per kind from the catalogue
  (`*.preheader`), escaped like any text and naming no tenant.
- **Size.** A rendered message is about 5.8 KB (the same in the outbox row, which stores the
  markup, and over the wire). The display name shown in the mail is cut to 80 code points and an
  ellipsis before anything is escaped, so a 10,000-character name adds nothing (tested at 10,000
  in `shell.test.ts`, under 14 KB a message). `loggingSender` logs the text part and the markup's
  byte count, `htmlBytes`, never the markup. At the phase spec's scale the outbox holds
  one such row per mail not yet reaped, which is the reap's retention to bound, not the shell's.
- **Escaping.** Unchanged and extended to the shell: every value through `escapeHtml`, the
  tenant in `<bdi>`, FSI/PDI in text, nothing that can start a line in the subject. The
  link is now escaped in the markup (it was inserted raw) and stays raw in the text.
  `templates.test.ts` and `shell.test.ts` run the hostile-name cases (script, bidi
  controls, CRLF, a long name, an RTL name, emoji) over every kind.
- **Colours.** `packages/email/scripts/generate-assets.ts` compiles the tokens to hex
  (`palette.generated.ts`, from `apps/admin-console/src/shared/view/tokens.css`) and
  draws the mark. `palette.test.ts` fails when the committed palette is not what the
  tokens compile to, and `shell.test.ts` fails on any colour in a mail that is not in it
  (no `rgb()`, `var()` or `light-dark()`). `palette.test.ts` also holds the text pairs to 4.5:1
  in both palettes: the console's own pairs, with the button on `--ink-primary`, as the
  server pages' buttons are.
- **The mark.** A 80x80 PNG (shown at 40x40), the staff in `--ink-rail` on a `--surface-rail` rounded
  tile with a 1px ring in `--ink-rail-muted` (a mid tone that shows on the light page and on
  the dark one, where the tile alone was nearly invisible), so one image reads on either palette. It is rasterised from `mark.svg` by a small
  anti-aliasing drawer in the package (`mark-png.ts`; the committed bytes are compared pixel for
  pixel with a fresh drawing, not byte for byte, so a different zlib cannot fail it).
  It travels as an inline `cid:odudu-mark` part: `smtpSender` adds the attachment to any message
  whose markup names it, so a self-hosted install needs no public asset URL and nothing is fetched
  when the mail is opened. `alt="odudu"` shows where images are blocked.

verified: `node_modules/.bin/vitest run --project integration packages/email/tests/smtp.int.test.ts`
(Mailpit v1.31.5: the message arrives with one inline part, `ContentID` `odudu-mark`, `image/png`), and on the stack
`odudu-p4g-mail` a tenant relay at a Mailpit container delivered the required-actions mail, whose
Mailpit page (`/view/<id>.html`) drew the shell with the mark.

### What the clients do, and what degrades

Relied on, from the clients' documented behaviour and not tried in them (only Chromium was
run here, on the real messages and on Mailpit's rendering): table layout and inline style
everywhere; `<style>` in the head, which Gmail (web and apps), Apple Mail, Outlook 2019+/365
and Yahoo keep and old Gmail variants and some webmail strip; `max-width` on a table, which
the Word-engine Outlooks ignore, hence the ghost table; padding on a cell, which every client
honours, where padding on the anchor is ignored by the Word engine.

Dark mode is partial. A client that reads `prefers-color-scheme` (Apple Mail, iOS Mail,
Outlook for Mac and the new Outlook, Thunderbird, Fastmail) gets the dark palette. Gmail's apps
darken a light mail by inverting its colours themselves, so the light palette is what they
transform; the Outlook.com and Outlook-on-Windows dark modes rewrite colours too and may
differ from the palette. A client that does neither gets the light version, which is the one
every text pair is checked against and is fully readable. The corners round in clients that
honour `border-radius` and are square in the Word engine. The mark's tile is dark in both
schemes and carries a mid-tone ring, so it needs no variant.

Per-tenant mail theming (the tenant's own colours and logo in the shell) stays with **P4b**,
whose criterion already names the verification and reset mail rendered under a tenant's theme;
the shell takes its colours from one palette object, which is what that phase replaces.

### Mail gallery

Chromium, every kind rendered by `packages/email/scripts/preview.ts` (the inline mark swapped for a
data URI so the file opens alone), light and dark, 600px and 375px, cropped to the message.
The gallery holds twelve of the thirty-two views; the rest were looked at.

- ![verification, light, 600px](p4g-mails/verification-light-600.webp) `verification-light-600`: the verification mail.
- ![verification, dark, 600px](p4g-mails/verification-dark-600.webp) `verification-dark-600`: the same, the dark palette.
- ![verification, light, 375px](p4g-mails/verification-light-375.webp) `verification-light-375`: the same at phone width.
- ![verification, dark, 375px](p4g-mails/verification-dark-375.webp) `verification-dark-375`: dark, phone width.
- ![password reset, light, 600px](p4g-mails/password-reset-light-600.webp) `password-reset-light-600`: the reset mail.
- ![required actions, light, 600px](p4g-mails/required-actions-light-600.webp) `required-actions-light-600`: the required-actions link with its list.
- ![required actions, dark, 375px](p4g-mails/required-actions-dark-375.webp) `required-actions-dark-375`: the same, dark, phone width.
- ![second factor removed, light, 600px](p4g-mails/factor-removed-light-600.webp) `factor-removed-light-600`: the notice, no button and no link.
- ![recovery codes revoked, dark, 600px](p4g-mails/recovery-revoked-dark-600.webp) `recovery-revoked-dark-600`: the other notice, dark.
- ![SMTP test, light, 375px](p4g-mails/smtp-test-light-375.webp) `smtp-test-light-375`: the SMTP test mail.
- ![a very long tenant name](p4g-mails/verification-long-name-light-375.webp) `verification-long-name-light-375`: a 192-character name, cut at 80 characters and an ellipsis.
- ![a right-to-left tenant name](p4g-mails/verification-rtl-light-375.webp) `verification-rtl-light-375`: an Arabic name in an English mail, isolated.

What the first look found and was fixed: a long name with no break widened the page past the
phone (every text block now wraps anywhere), the footer sat 4px inside the card's edge, the
mark was small in its tile, and in the dark palette the tile's edge was invisible against the page (now ringed).
The wrap of an unbroken run is held by `shell.test.ts` and was looked at before the name cap made the sample shorter.

## Increment 22: the path documents in the site

`request-paths`, `admin-paths` and `console-paths` now exist twice: as the three
originals, and cut by section into `apps/docs/content/en/reference/protocol/` (24 pages and an
index), `reference/admin-api-paths/` (70 and an index) and `admin-console/paths/` (20 and an
index). "What is not implemented" stays in `request-paths` until the roadmap page takes it, so
the protocol pages are the guide without that list. The tests read the pages
(`loadPages` in `tests/docs/markdown.ts`, which gives back the one document the pages were cut
from, with `at(document, line)` citing `page:line`); `tests/docs/split-preserves-the-documents.test.ts`
holds every line of each original, in order, against its pages. Only page boundaries, front matter,
link targets and the padding of a table row may differ.

The split was a one-off script kept out of the tree. Its three rules: cut at each `^## ` outside a
fence, name the page by the heading's slug (at most 80 characters), and give it a `title` and a
`description` (the first sentence of its first paragraph, 50 to 150 characters); then retarget every
Markdown link, with `github-slugger` for the anchors, to the page that now holds the heading, or to
`https://github.com/wizzywit/odudu/blob/main/...` for a file the site does not hold. No prose was edited.
A line that carries bare HTML outside a fence or code span would have been listed for a human: there
were none. verified: `node --no-warnings <script>.ts`, then `prettier --write` on the three directories.

- **Build.** `pnpm --filter @odudu/docs build:pages`: 9 s with `generate` and `docusaurus clear`.
  Largest page, `protocol/path-a-authorization-code-with-pkce`: 370,504 bytes of HTML (41 KB gzip),
  against 1.37 MB unsplit; the largest admin page is 119 KB. Largest content chunk 29 KB gzip
  (157 KB unsplit). First load of that page is the runtime (5.6 KB) and `main` (168.8 KB) plus the
  chunk: about 203 KB gzip, 3 KB over the 200 KB figure the landing and docs pages were held to
  before the search index and these chunks, so the budget needs a decision where it is enforced.
- **Fenced blocks.** `apps/docs/tests/transcripts.test.ts` compares every fenced block of every page
  with the `<pre>` text of the built page (`.token-line` rows joined by a newline), in both targets:
  all of them identical. Changing one space in a source block fails it.
- **A page's first heading is its title only when that is lossless.** A heading with no markup and at
  most 60 characters becomes the page's `# `, and its sub-headings move up a level (`loadPages` moves
  them back); a link to that heading is a link to the page, because Docusaurus gives an `h1` no id.
  Every other page keeps `## `, with a plain `title` under 60 characters. The agent-copy plugin drops a
  duplicate title heading only when it matches the title exactly and holds no inline code, so a
  promoted heading with backticks left two copies of it in the Markdown copy.
- **Front matter has limits the site tests set.** A description is 50 to 150 characters and unique:
  the llms plugin cuts at 150 and the copy test compares the description it prints with the page's, and
  no `://` may appear in it. A title is at most 70 characters and unique across the site; four needed
  an override (two `The shape of it` and `What to do next` headings, two console refusals).
- **`agent-links.ts` did not rewrite a link whose text holds inline code or wraps a line.** Both are
  everywhere in the moved pages, and the copies kept `./page.md` links that resolve nowhere. It now
  blanks code spans instead of cutting around them and no longer needs the `[` on the same line
  (`agent-links.test.ts`, one row for each form, each failing before the change).
- **`csp.test.ts` read `style=` out of escaped text.** A transcript shows markup, and the raw reader
  took ` style=` in its text for an attribute; it now reads attributes inside tags only. The CSP
  script, which parses, was right: 9 style-attribute hashes before and after.
- **`links.test.ts`** exempts the three transcript directories from "no absolute `/docs/` path": they
  record the server's own `/docs` route, which is not an address on this site.
- **Sidebar.** Each directory is a category (`Request paths`, `Admin paths`, `Console paths`) under
  its section, expanded, because a collapsed category renders its children lazily and a page three
  clicks from home fails the information-architecture walk. The section pages link to the index of
  each. The category labels equal the indexes' `h1` because the breadcrumb ends at the label.
- **Left for the roadmap page.** `request-paths#what-is-not-implemented` is linked from seven pages
  as a repository URL. `phase-references.test.ts` reads both the pages (floor 4) and the original
  (floor 20) until the list moves.

## Increment 22b: the documentation as a story

Owner feedback on the migrated pages: heavy navigation, no order, contributor prose on reader pages.
The three transcript directories moved under Reference, and the site gained the journeys an adopter
reads first.

- **Layout.** `reference/protocol`, `reference/admin-api-paths` and `admin-console/paths` became
  `reference/transcripts/{request-paths,admin-paths,console-paths}`, with a `Transcripts` page above
  them. The three groups are collapsed in the sidebar, so a route list never sits in the navigation;
  the Reference page links the three group indexes, which list every page in `order.json` order
  (`tests/journeys.test.ts` holds the lists to the orders). Every relative link was re-resolved by
  script; no prose in a transcript changed except as below.
- **Sidebar by reader goal.** Start here (Introduction, Quick start), Guides, Concepts, Admin console,
  Operating Odudu, Reference, Security, Contributing. `SECTION_ITEMS` became `SIDEBAR_ITEMS`; the
  section labels and `SECTIONS` are as before, and the sidebar does not rename Operating Odudu to
  "Run it" because the breadcrumb ends at the page's own title. A `sidebarItemsGenerator` drops a
  directory's `index` from its category's items; without it the guides listed "Guides" as their last
  child.
- **Journeys.** `guides/` holds four pages in second person: `sign-a-user-in`,
  `refresh-and-end-a-session`, `admin-signs-in-and-changes-a-user`, `read-a-refusal`. Each step is a
  `##` with a goal sentence or two, one excerpt and a link to its full transcript.
  `tests/journeys.test.ts` fails when an excerpt is not a substring of a fenced block on a transcript
  page the same step links, when a step with an excerpt links none, and when an excerpt passes 24
  lines. The excerpts were cut from the transcripts by a script that slices lines, never typed.
  The console journey draws on three runs (ports and ids differ between steps) and says so.
- **Contributor prose.** The opening of each original document (how and on which stack it was
  captured) moved verbatim to `contributing/transcripts.md`; each group's `index.md` is now written for
  a reader. `split-preserves-the-documents.test.ts` compares each original after its opening with the
  pages after their index, and holds the opening to the contributing page in order. **Still in the
  transcript bodies:** "recaptured on..." and run-provenance sentences inside individual pages, and
  repository paths in prose. They are the transcripts' own record and the original documents still
  carry them. Done in Increment 23.
- **One heading per page.** 67 route pages had a plain `title` rendered as `h1` and the same route as
  a code `h2`. Where the heading is at most 60 characters its page now opens with it as the `# ` (its
  sub-headings moved up one level, as `loadPages` already allows) and the title is its text without
  the code marks; 32 links to such a heading became page links. The long multi-route headings and the
  two duplicate-titled admin pages keep the old shape. `agent-title.ts` drops, from a page's Markdown
  copy and its section of `llms-full.txt`, a repeat of the title that differs only by code marks
  (`agent-title.test.ts`, failing before `dropRepeatedTitle` existed).
- **Home.** `HomeMap` replaces `SectionGrid`: Quick start as the one primary card, the four journeys
  numbered, the other sections as a quieter grid. Both the image's home and the landing use it.
- **Code blocks.** A block's background is `var(--code-surface)` so a shadow can fade into it, and
  the edge with more to scroll carries one (`background-attachment: local` over `scroll`); route
  headings in the contents list wrap instead of being clipped.
- **Stub pages.** Introduction, Quick start, Guides, Concepts and the console page keep their
  `filled by` markers but open with a real outline built only from what exists today.
- **`ia.test.ts`, changed on purpose.** The sidebar-order test reads `concepts/index.html`, where
  every category but Start here is collapsed, instead of `guides/index.html`, where the guides expand.
  The reach walk allows one more click (home, Reference, group index, page) for pages under
  `reference/transcripts/` only. New: the guides' sidebar lists the four journeys in order, the
  Reference page's sidebar names no transcript page, and the home links every journey.

Before and after, light and dark, 1280 px and 375 px (the try stack's pages are the "before"):

![Home, before](p4g-docs/22b-before-home-desktop-light.webp)
![Home, after](p4g-docs/22b-after-home-desktop-light.webp)
![Console path, before](p4g-docs/22b-before-console-desktop-light.webp)
![Console path, after](p4g-docs/22b-after-console-desktop-light.webp)
![Reference, before](p4g-docs/22b-before-reference-desktop-light.webp)
![Transcripts, after](p4g-docs/22b-after-transcripts-desktop-light.webp)
![A journey, after](p4g-docs/22b-after-journey-desktop-light.webp)

The other variants are `p4g-docs/22b-{before,after}-{home,console,reference,transcripts,journey}-{desktop,phone}-{light,dark}.webp`.

## Increment 23: the roadmap page, the citations, the retirement

- **Roadmap.** `apps/docs/content/en/roadmap.md` holds the "What is not implemented" list and the
  P4d gap-audit list, with a note that the hosted service is planned and unscheduled (ADR 0042).
  Read against the phases that closed: every marker still names an open phase or a decision. One
  line was corrected (translated pages and mail: the catalogue mechanism exists, P4b ships the
  locales, P4h the console's catalogue). "No published image or release process" stays under P4g
  because no image has been published yet. The page sits in the Reference category of the sidebar,
  is linked from the introduction and the reference index, and is two clicks from home.
  `not-implemented-placement` and `gap-audit-placement` read it; `phase-references` holds it to 49
  citations, the protocol pages to 4.
- **Retirement.** The three path documents under `docs/` (request, admin and console) are deleted. 50
  files outside `docs/archive` cited them; each citation now names the page (README, ADRs, phase
  and protocol notes, source comments), with heading anchors resolved through the headings of the
  original against the pages (github-slugger) rather than typed. `retired-documents.test.ts` fails
  on any citation of a retired path outside the archive and on the files existing.
- **What replaced the split test.** `split-preserves-the-documents` compared every line of each
  original with its pages and has nothing to compare with now. `transcript-pages.test.ts` keeps
  its order, front-matter, Markdown-only and repository-link checks, adds a floor per group on
  fenced blocks (656, 616, 161), and keeps the capture-notes page to one section per group.
  `apps/docs/tests/transcripts.test.ts` still holds every fenced block to the built page. The
  floors of `references.test.ts` (protocol pages: repository paths 5 to 4) moved with the prose
  that no longer names a path.
- **Link check.** `lychee` is not installed here and was not downloaded, so the heading-anchor half
  of the brief is `tests/docs/link-fragments.test.ts`: every link with a `#fragment` into a Markdown
  file outside the archive and the generated reference must reach a heading, with a site page's
  `h1` carrying no anchor. Its first run found no dead anchor in the moved pages; a scratch file
  with a broken anchor failed it. File-level links were already held by `references.test.ts`.
- **Transcript pages for readers.** Run provenance and source paths are gone from the prose of the
  three groups: ordinal stacks, compose project names, commits, "captured against", "From the
  seventh run", and 150 sentences naming `packages/...`, `apps/...` or `tests/...`. Fenced blocks
  are byte-identical (checked per file against HEAD). Front matter descriptions that carried the
  provenance were rewritten. `transcript-pages.test.ts` fails on any of these patterns in prose; it
  was shown to fail on a planted line. `contributing/transcripts.md` keeps the stack notes.
- **Placed: Increment 36a (the whole-docs reading pass).** The 18 pages whose long multi-route
  heading stays an `h2` under a short `title`. The choice is the breadcrumb: the last crumb must
  equal the `h1`, so either the long heading becomes both, or the heading is shortened to the title
  and the routes move into the first paragraph. Listed in the plan's Task 36a.
- **A rule softened on purpose, then restored.** The first retargeting of CLAUDE.md traded "name the
  stack it was captured against" for "say what had run before it", and the page test banned
  "captured on/against". The rule is back at full strength: a transcript whose output depends on
  earlier state names the stack in words a reader can reproduce; the page test bans a date, a run, a
  compose project, an ordinal stack and a commit, not "captured against a stack driven only as far
  as Path A".
- **Fix round.** `references.test.ts` already failed on a dead relative link in every Markdown file
  outside generated output, the archive included; it now also pins that its document set holds
  README, CLAUDE, NEXT, the ADRs, phase notes, specs, the archive and the site source. Source
  comments cite the page, not the directory. NEXT's localization row and sentence say the catalogue
  mechanism exists and name what P4b and P4h still own.

## Increment 24: the introduction, the quick start and the integration guides

- **Pages.** `introduction/{index,odudu,compare}`, `quick-start`, and in `guides/` the web app, the
  single-page app, the API, the service and Keycloak guides. The introduction's two sub-pages sit in a
  collapsed category under Introduction so they have a sidebar and a breadcrumb (`seo-html.test.ts`
  requires both of every docs page). `compare.md` links no site outside the repository, because the
  image build allows no anchor to another origin (`csp.test.ts`); the four projects are named in a
  table that says "see their documentation".
- **Runnable.** 59 commands carry `sh {run}`; `MINIMUM_BLOCKS` is 59. `docs-commands.yml` runs the quick
  start before the guides, since it makes the `demo` tenant and `ada`, and exports `COMPOSE_FILE` (an
  absolute path) and `COMPOSE_PROJECT_NAME` so `docker compose exec odudu ...` in a guide finds the CI
  stack as it finds a reader's. `quickstart/stack.sh` unsets `COMPOSE_FILE` because it runs in its own
  directory. verified: `quickstart/stack.sh up odudu-p4g24:latest 3195` on a fresh volume, then
  `node tools/docs-run/src/index.ts apps/docs/content/en/quick-start apps/docs/content/en/guides`:
  `59 runnable blocks, 0 failed`.
- **Found while running them.**
  - `docker compose exec odudu odudu seed ...` failed on the quickstart stack: its configuration is
    `quickstart.env` on the state volume, read through `node --env-file=` by the server's own command, not
    in the container's environment. `infra/docker/odudu` now loads that file when it exists, and sets
    `NODE_NO_WARNINGS` so a command's output is not led by two experimental-API warnings
    (`tests/lint/odudu-shim.test.ts`).
  - `docker compose exec` reads standard input, so a block that ran it swallowed the rest of the session's
    script. The runner gives each block empty standard input (`session.test.ts`).
  - `seed client --client-secret` with no `--redirect-uri` surfaced the CHECK
    `client_oidc_config_redirect_uris_present` as a raw database stack trace. It is now
    `seed_invalid_options` naming `--redirect-uri` and the `--grant-type client_credentials` alone that a
    service client uses (`seed.int.test.ts`).
  - The seed examples for `--group` read `staff`, which the command refuses (`no group at path "staff"`):
    a group is addressed by its path, `/staff`. The registry examples, and so the generated command
    reference, now say so (`registry.test.ts`).
  - The runner ignored an attribute it could not read: an `expect=` without quotes asserted nothing.
    `extractRunnable` now refuses it. Prettier also rewrites a backslash-escaped quote in a fence's info
    string, so no `expect` text holds a double quote.
- **Not written, and placed.** The "Protect an MCP server with Odudu" guide. verified: `curl
$ODUDU_BASE/.well-known/oauth-authorization-server/tenants/demo` answers 404 and the demo tenant's
  discovery document names no `registration_endpoint`. The RFC paths: `curl -sS
https://www.rfc-editor.org/rfc/rfc8414.txt | grep -m2 oauth-authorization-server` and the same on
  `rfc9728.txt` with `oauth-protected-resource`. The gap is a roadmap item under P5a (the MCP authorization
  profile and this guide), and design spec section 11's P5a row now says the guide is written against the
  passing profile instead of being a P4g deliverable. A guide for behaviour the tenant lacks would show
  nothing that runs.
- **Roadmap claims.** SCIM inbound provisioning and moving more than 10,000 subjects were placed in the
  design spec (P7) but missing from the roadmap page; pages said the roadmap named them. The P7 item is
  on the page, and `tests/docs/roadmap-claims.test.ts` fails when a sentence about the roadmap names a
  listed capability the page does not (the list of terms is short; add one when a page first uses it).
- **Left for the example applications.** Each integration guide ends at a working sign-in done with
  `curl`, playing the browser. The example application of its kind arrives with the increments that build
  them and adds its section to the guide.

## Increment 24b: the quick start through the console

- **Tabs.** `quick-start/index.mdx` (the first `.mdx` page) gives each setup step a Console and a Command
  line tab, `groupId="route"`, the console first. The command-line tabs are the runnable blocks as
  before (59, run by docs-run). The llms plugin already turns tabs into bold labels and drops components;
  `plugins/agent-mdx.ts` drops the import lines it leaves, `llms.test.ts` fails on an import or component
  tag in an `.mdx` page's copy, and the copy keeps no screenshot. A fence inside a tab sits at column 0
  between blank lines, which `extractRunnable` reads unchanged.
- **What the console does differently.** It cannot choose a person's password: `POST /subjects` writes an
  `update-password` action by rule, and the Credentials tab issues a one-time password. The page says so in
  one sentence and the roadmap places it as a decision. Creating a tenant is two steps in the console (the
  tenant, then its first administrator); the tenant exists after the first, which the page states. The
  console's sign-in first asks which tenant you administer (`system`), which the old page never said.
- **Names.** Every bold name on the page must be defined in the console's sources or the sign-in
  messages (`console-labels.test.ts`; a template such as `Enter ${name}` defines "Enter demo").
- **Captures.** `pnpm docs:screenshots` (`apps/docs/scripts/console-shots/`): `screens.ts` is the list a
  later page extends; `capture.ts` signs in as the stack's administrator (`ODUDU_BASE`,
  `ODUDU_ADMIN_EMAIL`, `ODUDU_ADMIN_PASSWORD`, so a generated, not yet changed password is refused),
  creates `demo`, `my-app` and `ada` through the console itself when they are missing, checks each
  screen's expected headings and controls, and writes a light and a dark WebP (Chromium's canvas encodes
  them) with `manifest.json` to `static/console/`. `guard.ts` refuses a capture that shows the given
  password, a filled password field, a dialog saying "the only time ... is shown", or a banner password
  line. `ConsoleShot` shows the capture of the page's theme, sized, lazy, with alt text and a caption;
  `console-shots.test.ts` ties pages, screens and files together. verified: a run against the quickstart
  stack on port 3195 wrote 16 files, twice (the second run found the data and skipped creating it).
- **Not done.** The guides' own registration steps stay command-line only, and the capture is not yet a
  CI job (the tour increment wires it, with the e2e stack).
- `.webp` joins the types the docs route serves (`DOCS_TYPES`).

### Increment 24b, fix round

- **Names.** `console-labels.test.ts` is a table: each bold name on the page, the one console file that
  renders it and the exact text there; a template (`Create ${noun}`) lists the file that binds each part and
  is expanded, with no wildcard. A name not in the table fails; a console label renamed fails (mutation
  checked with `label="Kind"` renamed, and with "Create a widget" on the page).
- **Capture safety.** The guard now scans all text nodes (hidden ones too), every attribute value and every
  field for the given strings, a token with the length and alphabet of a generated secret (mixed case, a digit,
  few hyphens, UUIDs removed), the shown-once sentence anywhere, and the banner line; it is given the admin
  password and any admin username other than the published default. The rail's "Signed in as" is rewritten to
  the published default, the stack's origin to `http://localhost:3000`, and every time to "just now". The
  secret-issuing requests (`POST .../subjects/{id}/password`, `.../clients/{id}/secret`) are aborted and fail
  the capture; a run that clicked **Issue password** failed with the request named (mutation checked), a
  guard with the token rule removed failed its test, and a token appended to a record failed
  `console-shots.test.ts`. The run refuses a host other than this machine, and the lists must hold exactly
  `odudu-admin` and `my-app`, and `ada`.
- **A record beside the images.** `record/<screen>-<theme>.txt` holds the text each page held, committed, and
  scanned by a test for the shapes above, for the rows and for the published origin.
- **Not byte-identical.** Two captures of one screen differ in a few pixels from run to run (a flake of one
  to three of sixteen images in repeated runs; a settle wait, `animations: 'disabled'`, a hidden caret and
  a moved mouse did not remove it, the last made it worse). The records are identical, so `--check` compares
  records and the manifest, and says so.
- **Minor, not done.** A narrower viewport for larger text on screen (the images are 1100 px wide in a column
  of about 750; a smaller capture changes every layout and every alt text, left for the tour increment, which
  owns the capture and its CI job); no-JavaScript readers see the first tab only, and a dark-OS reader without
  JavaScript sees the light image (standard Docusaurus tabs; the agent copies carry both routes).

## Increment 25: the seven concepts

- **Pages.** `concepts/` holds an index and seven pages (tenants, clients, scopes, roles and groups, sessions, tokens,
  consent and audit), each a short story, a diagram, the rules and a numbered "Working with" list. The concepts
  sidebar entry is now a directory of the seven. "Recovery codes" is a section of the sessions page, because a set is
  what stands in for a second factor at sign-in; it states one set per person (ten codes), a code that stands in for a TOTP
  code and never follows a passkey, whole-set revocation with the audit action when the last TOTP goes, and the admin
  revoke with `require_new_set`.
- **Diagrams.** `src/components/Diagram/` draws each diagram inline as React SVG, so it sits in the page's own tree and
  every colour is one of Instrument's custom properties (`--surface-sunken`, `--signal-active`, `--ink-primary`, ...), which
  follow the site's colour toggle, not the system setting. (A first version used standalone SVG files through `<img>`, which
  cannot read the page's properties and followed only the OS scheme.) The seven concept pages became `.mdx` to import it:
  `<Diagram name title desc />` followed by an italic "In words" paragraph repeating `desc`. The llms plugin drops the
  component and keeps the paragraph, so a Markdown copy carries the description and no drawing. Colours are presentation
  attributes (`fill="var(--...)"`), so no `style` attribute reaches the policy's hash inventory, and the diagrams need no
  asset, data URI or CSS file but a two-rule module. Every diagram is one portrait 340-unit viewBox, nodes stacked
  vertically, text 13 to 15 units, shown at most 22rem wide, so text renders at 13 to 14.5 px on a 375 px phone.
- **Alt text.** Not applicable now: the text alternative is the SVG's own `<title>` and `<desc>` through
  `aria-labelledby`, equal (tested) to the page's props.
- **Checks.** `apps/docs/tests/concepts.browser.test.ts` (built site in Chromium, theme changed with the site's toggle
  while the system scheme says the opposite; on a phone through the menu's toggle): the computed contrast of every text
  against the surface it sits on is at least 4.5 and of every arrow against the page at least 3, every text lies inside its
  drawing, the rendered text is at least 12 px at 375 px, nothing scrolls sideways, and axe finds no violation, for all
  seven pages, light and dark, phone and desktop. `apps/docs/tests/concepts.test.ts`: structure, word count (400 to 900),
  one `<Diagram>` per page with the title and description in the built `<svg>` and the description in the Markdown copy,
  the component's source carrying no hard-coded colour, `style` or link, every stated number
  against the migration or constant that sets it (`FACTS`), and every code-font name that looks like a setting, claim or
  action against the sources. `tests/docs/concept-claims.test.ts`: every `METHOD /path` a page names against the
  server's router, the consent decision against `decideConsent`, the recovery rules against `recoveryApplicable`, and the
  refusal budget against its constant. The server-importing half lives in `tests/docs` because `apps/docs/tsconfig.json`
  cannot typecheck the server's sources. Mutation checked: a stated default changed on a page, and a route renamed.
- **Screenshots.** `docs/phases/p4g-docs/concept-sessions-*` and `concept-tokens-*`, desktop and 375 px, light and dark.
- **Sidebar test.** `ia.test.ts` read the section list from the concepts page; with the concepts opened it now reads it
  from the quick start and asserts the seven pages beneath concepts in order.
