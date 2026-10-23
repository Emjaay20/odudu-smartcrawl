// The required actions a mailed link may take a subject through, in the
// order the sign-in flow asks for them; each page and mail words them from
// its own catalogue. The vocabulary is `requiredActionSchema`'s
// (@odudu/contracts), which this package does not depend on; the admin route
// holds a request to it before a link is ever minted.
const ORDER = [
  'update-password',
  'configure-totp',
  'configure-passkey',
  'generate-recovery-codes',
] as const;

export type LinkedRequiredAction = (typeof ORDER)[number];

export function isLinkedRequiredAction(value: string): value is LinkedRequiredAction {
  return (ORDER as readonly string[]).includes(value);
}

/** Each named action once, in the order they are asked; anything unknown is dropped. */
export function orderedActions(actions: readonly string[]): LinkedRequiredAction[] {
  return ORDER.filter((action) => actions.includes(action));
}
