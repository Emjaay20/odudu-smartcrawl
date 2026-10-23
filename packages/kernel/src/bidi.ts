import { BIDI_REFUSED_MESSAGE, refusesBidi } from '@odudu/contracts';
import { OduduError } from '#/errors';

export { BIDI_REFUSED, containsBidiControl } from '@odudu/contracts';

// Names the field, never the value: a log line is one `logger.error({ err })`
// away from an error message.
export class BidiControlError extends OduduError {
  readonly field: string;

  constructor(field: string) {
    super('bidi_control_refused', `${field} ${BIDI_REFUSED_MESSAGE}`);
    this.name = 'BidiControlError';
    this.field = field;
  }
}

/**
 * The guard every repository applies to a typed identity, name or display text
 * field before it writes one. A write that leaves the stored `current` value as
 * it is passes, so a row from before the rule is never blocked or rewritten.
 */
export function refuseBidiControls(
  field: string,
  value: string | null | undefined,
  current?: string | null,
): void {
  if (refusesBidi(value, current)) throw new BidiControlError(field);
}
