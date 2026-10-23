import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// What a hook returns on its first render on the server, effects not run.
export function resultOf<T>(hook: () => T): T {
  let result: { readonly value: T } | undefined;
  function Probe(): null {
    result = { value: hook() };
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (result === undefined) throw new Error('the hook did not run');
  return result.value;
}
