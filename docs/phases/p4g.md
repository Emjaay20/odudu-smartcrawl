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
  `request-paths.md`, `admin-paths.md` and `console-paths.md` copied into
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
  `../README.md` and `request-paths.md#…` as written. Plan change: agent copies
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
  passes `${ODUDU_REVISION:-unknown}` and the `container` and `e2e` jobs set it
  to `github.sha`. `smoke.sh` asserts the label. The conformance rig's own
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
- A French catalogue exists in tests only (`tests/support/fr-catalogue.ts`,
  imported as `#test/fr-catalogue`): a renderer test mocks `#/view/messages`
  with `withFrench`, so the real renderer is the one rendering French.
  `SHIPPED_LOCALES` stays `en`.
- The English text is byte-identical to before except three things, each one
  re-recorded in `docs/request-paths.md`: user-controlled values sit in
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
