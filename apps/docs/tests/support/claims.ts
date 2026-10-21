// A length of time promised to the reader, which nothing measures: "ten
// minutes", "in a few minutes", "under 5 mins", "a minute", "two hours", "a
// 10-second wait" and the bare word "minutes". "A second app" is not one.
export const TIME_CLAIM =
  /\b(?:(?:\d+|two|three|four|five|six|seven|eight|nine|ten|few|several|couple of)[ -](?:minutes?|mins?|seconds?|secs?|hours?)|(?:a|an|one)[ -](?:minute|min|hour)|minutes)\b/iu;

export const TIME_CLAIM_EXAMPLES = {
  caught: [
    'ten minutes',
    'in a few minutes',
    'under 5 mins',
    'give it a minute',
    'two hours',
    'takes minutes',
    'a 10-second wait',
  ],
  allowed: ['a second app', 'the first start is slower', 'minimum', 'Open a second app'],
} as const;
