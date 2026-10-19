import { BIDI_REFUSED_MESSAGE, containsBidiControl } from '@odudu/contracts';
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

/** The guard every repository applies to a typed identity or name field before it writes one. */
export function refuseBidiControls(field: string, value: string | null | undefined): void {
  if (value !== null && value !== undefined && containsBidiControl(value)) {
    throw new BidiControlError(field);
  }
}
