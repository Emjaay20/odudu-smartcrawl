import { type RenderedPage } from '@odudu/kernel';
import { page } from '#/view/document';

// Identical whichever budget refused the request and decided before any
// account lookup, so it names no cause and offers no link: building one
// would need a read of the parked request, which a flood must not cost.
export function renderThrottledPage(retryAfterSeconds: number): RenderedPage {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  const unit = seconds === 1 ? 'second' : 'seconds';
  return page(
    'Too many attempts',
    `<h1>Too many attempts</h1>
<p>Try again in ${String(seconds)} ${unit}.</p>
<p>Go back to the previous page when the time is up.</p>`,
  );
}
