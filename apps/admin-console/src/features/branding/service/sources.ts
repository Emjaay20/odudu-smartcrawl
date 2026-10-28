import type { ThemeView } from '@odudu/contracts/admin';
import type { ThemeScope } from '#/features/branding/service/scope';

type Source = 'client' | 'tenant' | 'default';

const WORDS: Readonly<Record<ThemeScope['kind'], Readonly<Record<Source, string>>>> = {
  tenant: { client: 'this client', tenant: 'this tenant', default: 'Instrument’s default' },
  client: { client: 'this client', tenant: 'the tenant', default: 'Instrument’s default' },
};

export const SOURCE_NOTE =
  'Each piece comes from the first layer that sets it: the client, else the tenant, else Instrument.';

function wordsFor(scope: ThemeScope, source: Source | undefined): string {
  return WORDS[scope.kind][source ?? 'default'];
}

// Which layer supplies a piece: of the draft once there is one, and of what
// users see now. `piece` is the server's name for it, such as `assets.logo`.
export function sourceReading(scope: ThemeScope, view: ThemeView, piece: string): string {
  const published = `Published: ${wordsFor(scope, view.sources[piece])}`;
  if (view.draft_sources === null) return published;
  return `Draft: ${wordsFor(scope, view.draft_sources[piece])} · ${published}`;
}
