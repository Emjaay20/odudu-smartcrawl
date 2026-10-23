// A rule a candidate password broke, in the form the page that lists it
// reads: `rule` is the code a catalogue entry is looked up by, `message` the
// developer-facing sentence for a rule this build has no entry for, and
// `minLength` the number the minimum-length sentence states.
export interface PasswordViolation {
  rule: string;
  message: string;
  minLength?: number;
}
