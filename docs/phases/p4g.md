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
`/odudu/request-paths` and `/docs/request-paths`; `[dead](/nope/)` is reported
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
