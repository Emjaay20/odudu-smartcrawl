import type { Reach } from '#/features/clients/service/ceiling';
import type { AdminCapability } from '#/shared/service/principal';

export const BRANDING_LEAD =
  'The client’s own pages. A piece set here replaces the tenant’s for sign-ins that start from this client; a piece left unset follows the tenant’s theme, then Instrument’s.';

export const BRANDING_LOADING = 'Loading the client’s branding';

export const BRANDING_FAILED = 'The client’s branding could not be loaded';

export const BRANDING_HELD = 'The client’s branding is read and changed with';

export type BrandingOffer = 'checking' | 'held' | 'open';

// The theme routes need `manage-clients` and apply no service-account ceiling,
// so only a missing capability holds the tab back; until the caller's
// capabilities are known it offers neither the editor nor a refusal.
export function brandingOffer(needs: readonly AdminCapability[], reach: Reach): BrandingOffer {
  if (needs.length > 0) return 'held';
  return reach.status === 'checking' ? 'checking' : 'open';
}
