import { brandingProblems, PAGE_KINDS, type PageKind, type ResolvedBranding } from '@odudu/kernel';
import { type PublishedAsset, type PublishedLayer } from '#/service/theme-body';
import { assetIdsOf, parseThemeBody, type ThemeBody } from '#/service/body';
import { brandingCss, tokensCss } from '#/service/branding-css';
import { assetPath, stylesheetPath } from '#/service/branding-urls';
import { resolvePieces } from '#/service/resolve';
import { checkStylesheet } from '#/service/stylesheet';
import { checkTemplate } from '#/service/template';

const KINDS = Object.keys(PAGE_KINDS) as PageKind[];

export interface BuildInput {
  tenantName: string;
  // The origin pages are served from.
  origin: string;
  // Published layers, most specific first, as stored and so untrusted.
  layers: { name: 'client' | 'tenant'; layer: PublishedLayer }[];
}

export interface TemplateRefused {
  kind: PageKind;
  reason: string;
}

export interface BuildOutcome {
  // Null when no layer survives: the default theme.
  branding: ResolvedBranding | null;
  // The published versions that were read, `tenant.client`, for a log scope.
  version: string;
  // Why a layer or the whole theme was not used; never user text unquoted.
  problems: string[];
  // Templates dropped for the layer below, or the default.
  refused: TemplateRefused[];
}

interface Kept {
  body: ThemeBody;
  urls: Map<string, string>;
}

// A layer is used whole or not at all: a body that does not parse, an image
// that is gone, or one of a type no upload produces drops the layer, and
// the layer below answers. A template or stylesheet that fails today's
// checks drops that piece alone.
function keepLayer(
  name: string,
  tenantName: string,
  layer: PublishedLayer,
  problems: string[],
  refused: TemplateRefused[],
): Kept | null {
  const parsed = parseThemeBody(layer.body);
  if (!parsed.ok) {
    problems.push(`${name} theme version ${String(layer.version)} is not a valid body`);
    return null;
  }
  const { body } = parsed;
  const held = new Map<string, PublishedAsset>(layer.assets.map((asset) => [asset.id, asset]));
  const urls = new Map<string, string>();
  for (const id of assetIdsOf(body.assets)) {
    const asset = held.get(id);
    const path = asset === undefined ? null : assetPath(tenantName, asset.sha256, asset.mime);
    if (path === null) {
      problems.push(`${name} theme version ${String(layer.version)} names an image that is gone`);
      return null;
    }
    urls.set(id, path);
  }
  const own = new Set(urls.values());
  const isAssetUrl = (url: string): boolean => own.has(url);
  const accepted: ThemeBody['templates'] = {};
  for (const kind of KINDS) {
    const template = body.templates[kind];
    if (template === undefined) continue;
    const issues = checkTemplate(kind, template, { isAssetUrl });
    if (issues.length === 0) accepted[kind] = template;
    else refused.push({ kind, reason: issues.map((issue) => issue.code).join(',') });
  }
  body.templates = accepted;
  if (body.stylesheet !== null && checkStylesheet(body.stylesheet, { isAssetUrl }).length > 0) {
    body.stylesheet = null;
    problems.push(`${name} theme version ${String(layer.version)} has a stylesheet that fails`);
  }
  return { body, urls };
}

function logoOf(body: ThemeBody, urls: Map<string, string>): ResolvedBranding['logo'] {
  const { logo, darkLogo } = body.assets;
  const url = logo === undefined ? undefined : urls.get(logo.assetId);
  if (logo === undefined || url === undefined) return null;
  const dark = darkLogo === undefined ? undefined : urls.get(darkLogo.assetId);
  return { url, darkUrl: dark ?? null, alt: logo.alt };
}

// Resolves published layers into what a page is given, or null for the
// default theme. Total for any stored value: whatever is wrong with it is a
// reason in `problems`, never a throw.
export function buildBranding(input: BuildInput): BuildOutcome {
  const problems: string[] = [];
  const refused: TemplateRefused[] = [];
  const version = (name: string): string =>
    String(input.layers.find((entry) => entry.name === name)?.layer.version ?? 0);
  const outcome = (branding: ResolvedBranding | null): BuildOutcome => ({
    branding,
    version: `${version('tenant')}.${version('client')}`,
    problems,
    refused,
  });
  const kept = input.layers.flatMap((entry) => {
    const layer = keepLayer(entry.name, input.tenantName, entry.layer, problems, refused);
    return layer === null ? [] : [layer];
  });
  if (kept.length === 0) return outcome(null);

  const body = resolvePieces(kept.map((layer) => layer.body));
  const urls = new Map(kept.flatMap((layer) => [...layer.urls]));
  const tokens = tokensCss(body.tokens);
  const css = brandingCss(tokens, body.stylesheet);
  const favicon = body.assets.favicon;
  const logo = logoOf(body, urls);
  const background = body.assets.background;
  const urlOf = (id: string | undefined): string | null =>
    id === undefined ? null : (urls.get(id) ?? null);
  const assetUrls = [
    ...new Set(
      [logo?.url, logo?.darkUrl, urlOf(favicon?.assetId), urlOf(background?.assetId)].filter(
        (url): url is string => typeof url === 'string',
      ),
    ),
  ];
  const branding: ResolvedBranding = {
    origin: input.origin,
    templates: body.templates,
    tokensCss: tokens,
    stylesheetUrl: css === '' ? null : stylesheetPath(input.tenantName, css),
    faviconUrl: urlOf(favicon?.assetId),
    logo,
    assetUrls,
  };
  // A theme that sets nothing is the default look, and keeps the stock policy.
  const empty =
    css === '' && assetUrls.length === 0 && Object.keys(branding.templates).length === 0;
  if (empty) return outcome(null);
  const wrong = brandingProblems(branding);
  if (wrong.length > 0) {
    problems.push(...wrong);
    return outcome(null);
  }
  return outcome(branding);
}
