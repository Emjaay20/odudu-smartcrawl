import { createMemoryHistory } from '@tanstack/react-router';
import { expect, it } from 'vitest';
import { createConsoleRouter } from '#/app/router';
import { EVERY_AREA } from '#/features/shell';

it('has a route for every area the rail can list', () => {
  const router = createConsoleRouter(createMemoryHistory({ initialEntries: ['/'] }));
  const paths = Object.keys(router.routesByPath);
  const unrouted = EVERY_AREA.filter(
    (area) => !paths.includes(area.path === '' ? '/$tenant' : `/$tenant/${area.path}`),
  );
  expect(unrouted.map((area) => area.label)).toEqual([]);
});
