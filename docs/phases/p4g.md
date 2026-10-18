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
