// The pages the sign-in form offers beside itself, as paths on this server.
// Each is offered only while the tenant serves it: those pages answer 404 on
// the same two settings. `signInPath` is the authorize path rebuilt from the
// parked request, so the page the person goes to can bring them back to it.
export interface LoginWays {
  createAccount?: string;
  resetPassword?: string;
}

export interface LoginWaySettings {
  registrationAllowed: boolean;
  resetPasswordAllowed: boolean;
}

export function loginWays(
  tenant: string,
  settings: LoginWaySettings,
  signInPath: string | null,
): LoginWays {
  const base = `/tenants/${encodeURIComponent(tenant)}/login-actions`;
  const query =
    signInPath === null ? '' : `?${new URLSearchParams({ return_to: signInPath }).toString()}`;
  return {
    ...(settings.registrationAllowed ? { createAccount: `${base}/registration${query}` } : {}),
    ...(settings.resetPasswordAllowed ? { resetPassword: `${base}/reset-password${query}` } : {}),
  };
}
