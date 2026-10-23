// A single-page app: it signs a person in with the authorization code grant
// and PKCE, as a public client with no secret. The tokens live in a variable,
// so a reload signs the person out of the app. The client is registered
// without the refresh_token grant, so there is no refresh token to steal.
// Only the short-lived values the redirect needs, the PKCE verifier, the
// state and the nonce, wait in sessionStorage while the person is on Odudu's
// page. `allowInsecureRequests` lets the library talk to an http issuer; a
// real app serves everything over HTTPS and never sets it.
import * as oauth from 'oauth4webapi';
import { expiryOf } from './expiry.ts';

const BASE = import.meta.env.VITE_ODUDU_BASE ?? 'http://localhost:3000';
const ISSUER = new URL(`${BASE}/tenants/${import.meta.env.VITE_TENANT ?? 'demo'}`);
const CLIENT: oauth.Client = { client_id: import.meta.env.VITE_CLIENT_ID ?? 'example-spa' };
const REDIRECT_URI = `${location.origin}/callback`;
const PENDING = 'odudu.pending';
const options = { [oauth.allowInsecureRequests]: true };

interface Person {
  name: string;
  sub: string;
  idToken: string;
  accessTokenExpiry: Date | undefined;
}
let person: Person | undefined;

const root = document.querySelector('#app');

function show(text: string, action?: { label: string; run: () => void }): void {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  const children: HTMLElement[] = [paragraph];
  if (action !== undefined) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.addEventListener('click', action.run);
    children.push(button);
  }
  root?.replaceChildren(...children);
}

async function discover(): Promise<oauth.AuthorizationServer> {
  const response = await oauth.discoveryRequest(ISSUER, { algorithm: 'oidc', ...options });
  return oauth.processDiscoveryResponse(ISSUER, response);
}

async function signIn(): Promise<void> {
  const as = await discover();
  const pending = {
    verifier: oauth.generateRandomCodeVerifier(),
    state: oauth.generateRandomState(),
    nonce: oauth.generateRandomNonce(),
  };
  sessionStorage.setItem(PENDING, JSON.stringify(pending));
  const target = new URL(as.authorization_endpoint ?? '');
  target.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT.client_id,
    redirect_uri: REDIRECT_URI,
    scope: 'openid profile',
    code_challenge: await oauth.calculatePKCECodeChallenge(pending.verifier),
    code_challenge_method: 'S256',
    state: pending.state,
    nonce: pending.nonce,
  }).toString();
  location.assign(target);
}

async function finishSignIn(): Promise<Person> {
  const stored = sessionStorage.getItem(PENDING);
  // A callback can be used once: the values it needs are gone after the first.
  sessionStorage.removeItem(PENDING);
  if (stored === null) throw new Error('No sign-in is under way');
  const pending = JSON.parse(stored) as { verifier: string; state: string; nonce: string };
  const as = await discover();
  // Checks the state and the issuer the answer names.
  const params = oauth.validateAuthResponse(as, CLIENT, new URL(location.href), pending.state);
  const response = await oauth.authorizationCodeGrantRequest(
    as,
    CLIENT,
    oauth.None(),
    params,
    REDIRECT_URI,
    pending.verifier,
    options,
  );
  // Checks the ID token's signature, issuer, audience and nonce.
  const tokens = await oauth.processAuthorizationCodeResponse(as, CLIENT, response, {
    expectedNonce: pending.nonce,
    requireIdToken: true,
  });
  const claims = oauth.getValidatedIdTokenClaims(tokens);
  if (claims === undefined) throw new Error('No ID token');
  return {
    name: String(claims.preferred_username ?? claims.sub),
    sub: claims.sub,
    idToken: String(tokens.id_token),
    accessTokenExpiry: expiryOf(tokens.access_token),
  };
}

async function signOut(): Promise<void> {
  const idToken = person?.idToken ?? '';
  person = undefined;
  const as = await discover();
  const target = new URL(as.end_session_endpoint ?? '');
  // Odudu resolves the return address from the hint alone, but `client_id`
  // beside it is what every OpenID provider accepts, so the app sends both.
  target.search = new URLSearchParams({
    client_id: CLIENT.client_id,
    id_token_hint: idToken,
    post_logout_redirect_uri: `${location.origin}/`,
  }).toString();
  location.assign(target);
}

// The page keeps saying "signed in" after the access token lapses, because the
// app calls no API. An app that does checks the expiry before each call and
// signs the person in again when it has passed.
function render(): void {
  if (person === undefined) {
    show('You are signed out.', { label: 'Sign in', run: () => attempt(signIn()) });
    return;
  }
  show(
    `Signed in as ${person.name} (${person.sub}). ` +
      `Access token expires ${person.accessTokenExpiry?.toISOString() ?? 'at a time this app cannot read'}`,
    { label: 'Sign out', run: () => attempt(signOut()) },
  );
}

// The library's own wording for what failed, never the values it compared.
function why(error: unknown): string {
  const parts = [String(error)];
  if (error instanceof Error && error.cause instanceof Error) parts.push(error.cause.message);
  if (error instanceof oauth.ResponseBodyError) parts.push(error.error);
  return parts.join(': ');
}

// Something that failed before the person reached Odudu's page, such as an
// unreachable server, is shown rather than dropped.
function attempt(task: Promise<void>): void {
  task.catch((error: unknown) => {
    console.error(`failed: ${why(error)}`);
    show('Something went wrong.');
  });
}

if (location.pathname === '/callback') {
  finishSignIn().then(
    (signedIn) => {
      person = signedIn;
      history.replaceState(null, '', '/');
      render();
    },
    (error: unknown) => {
      console.error(`sign-in refused: ${why(error)}`);
      history.replaceState(null, '', '/');
      show('Sign-in was refused.', { label: 'Try again', run: () => attempt(signIn()) });
    },
  );
} else {
  render();
}
