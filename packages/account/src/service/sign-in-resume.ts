// The sign-in a browser still holds, as the composition root resolves it from
// the browser's cookie: the parked session and the authorize path rebuilt from
// the request it parked (null when that request cannot be rebuilt faithfully,
// as one bound to a subject by a hint cannot).
export interface HeldSignIn {
  readonly sessionId: string;
  readonly signInPath: string | null;
}

// Resolved at the composition root, where the cookie's secret and the parked
// request are both reachable; `header` is the request's raw Cookie header.
export type FindHeldSignIn = (
  tenant: { readonly id: string; readonly name: string },
  header: string | undefined,
) => Promise<HeldSignIn | null>;

// Which sign-in a mailed link may name: the one this browser holds, and only
// when the page it asked from carried that same request. Two tabs signing in
// to different applications share one cookie, which names the later; the
// earlier tab's form carries its own request, they differ, and no link is
// tied to a request the person did not ask from.
export function referenceToResume(held: HeldSignIn | null, returnTo: string | null): string | null {
  if (held === null || returnTo === null || held.signInPath !== returnTo) return null;
  return held.sessionId;
}

// Where a token's page may send the browser: the original request, only
// while this browser holds the very sign-in the token names. Anything else
// (another browser, an expired or finished sign-in, an administrator's link)
// reads the same, so the page cannot be used to tell them apart.
export function resumablePath(held: HeldSignIn | null, reference: string | null): string | null {
  if (held === null || reference === null || held.sessionId !== reference) return null;
  return held.signInPath;
}
