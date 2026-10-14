import { expect, it, vi } from 'vitest';
import { createBrowserTransport } from '#/shared/transport/transport';

it('gives each transport its own session events, so a listener of one never hears another', () => {
  const first = createBrowserTransport();
  const second = createBrowserTransport();
  const heard = vi.fn();
  first.events.on('sessionEnded', heard);
  second.events.emit('sessionEnded');
  expect(heard).not.toHaveBeenCalled();
  first.events.emit('sessionEnded');
  expect(heard).toHaveBeenCalledOnce();
});
