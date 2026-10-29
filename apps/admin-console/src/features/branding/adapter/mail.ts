import { mailBrandingViewSchema, type MailBrandingView } from '@odudu/contracts/admin';
import { adminCall, segment } from '#/shared/adapter/route';
import { GATEWAY_BASE, type Gateway, type GatewayResult } from '#/shared/transport/gateway';
import type { MailChoice } from '#/features/branding/service';

export function readMailBranding(
  gateway: Gateway,
  tenant: string,
): Promise<GatewayResult<MailBrandingView>> {
  return adminCall(gateway, 'GET', tenant, ['mail', 'branding'], {
    schema: mailBrandingViewSchema,
  });
}

// The mail the frame shows, fetched by the frame itself under the session
// cookie; no language asks for the tenant's default.
export function mailPreviewSource(tenant: string, choice: MailChoice): string {
  const path = ['admin', 'tenants', tenant, 'mail', 'preview'].map(segment).join('/');
  const query = new URLSearchParams({ scheme: choice.scheme });
  if (choice.locale !== '') query.set('locale', choice.locale);
  return `${GATEWAY_BASE}${path}?${query.toString()}`;
}
