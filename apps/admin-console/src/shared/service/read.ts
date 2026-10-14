import { isRefused } from '#/shared/service/failure';
import type { GatewayResult } from '#/shared/service/result';

// A read as the hooks hand it to a service: the services judge what it says
// without knowing which hook made it.
export type Loaded<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'failed'; retry: () => void };

// `refused` is a 403: the read needs a capability the caller lacks.
export type Read<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; refused: boolean; retry: () => void };

export function readOutcome<T>(result: GatewayResult<T> | undefined, retry: () => void): Read<T> {
  if (result === undefined) return { status: 'loading' };
  if (result.ok) return { status: 'ready', data: result.data };
  return { status: 'failed', refused: isRefused(result), retry };
}

export function loadedData<T>(
  read: { status: 'ready'; data: T } | { status: 'loading' | 'failed' | 'none' },
): T | undefined {
  return read.status === 'ready' ? read.data : undefined;
}

export function mapRead<T, U>(read: Read<T>, map: (data: T) => U): Read<U> {
  return read.status === 'ready' ? { status: 'ready', data: map(read.data) } : read;
}
