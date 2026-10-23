import {
  CORE_PROMPT_VALUES,
  promptValuesSupported,
  REGISTRATION_PROMPT_VALUE,
  type PromptValue,
} from '@odudu/contracts';

// OIDC Core §3.1.2.1's `prompt`: a space-delimited, case-sensitive list of
// ASCII values naming whether the authorization server may interact with the
// End-User at all. `create` is Initiating User Registration via OpenID
// Connect 1.0 §4: show the account creation page instead of the login. The
// values are the discovery document's, so what is parsed is what is listed.
export { promptValuesSupported, type PromptValue };

const DEFINED = new Set<string>([...CORE_PROMPT_VALUES, REGISTRATION_PROMPT_VALUE]);

function isPromptValue(token: string): token is PromptValue {
  return DEFINED.has(token);
}

export type PromptParse =
  | { kind: 'ok'; values: ReadonlySet<PromptValue> }
  // `none` or `create` combined with anything else, or a value this server
  // does not define. §3.1.2.1 requires the first and permits the third.
  | { kind: 'invalid' };

// Absent, empty, and all-whitespace all parse to no values: an empty
// parameter value is an omitted one (RFC 6749 §3.1), and a list of no values
// asks for nothing.
export function parsePrompt(raw: string | undefined): PromptParse {
  if (raw === undefined) return { kind: 'ok', values: new Set() };

  const values = new Set<PromptValue>();
  for (const token of raw.split(' ')) {
    if (token.length === 0) continue;
    if (!isPromptValue(token)) return { kind: 'invalid' };
    values.add(token);
  }

  // "If this parameter contains none with any other value, an error is
  // returned" — the two demands contradict each other, and a server that
  // picked one of them would be guessing which one the client meant.
  if (values.has('none') && values.size > 1) return { kind: 'invalid' };
  // Initiating User Registration §4 recommends `create` not be combined
  // with any other value, since "mutually exclusive conditions can arise";
  // refused for the same reason as `none`, rather than silently resolved.
  if (values.has('create') && values.size > 1) return { kind: 'invalid' };

  return { kind: 'ok', values };
}
