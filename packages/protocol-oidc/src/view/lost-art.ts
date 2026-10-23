// The drawing every not-found and server-error page carries, written out
// here because the server serves no file beside its pages. The source is
// packages/instrument/src/lost.svg; tests/lint/lost-art.test.ts holds them
// equal. The rules that move it are in the shared stylesheet, so a page needs
// no inline style; `calm` stills it for a failure.
export function lostArt(calm: boolean): string {
  const classes = (calm ? ['lost', 'lost-calm'] : ['lost']).join(' ');
  return `<svg class="${classes}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
<g class="lost-window"><rect x="6" y="26" width="44" height="36" rx="4"/><path d="M6 36H50"/></g>
<path class="lost-route lost-route-a" pathLength="1" d="M54 46C80 46 94 70 122 70"/>
<path class="lost-route lost-route-b" pathLength="1" d="M146 70C170 70 182 50 200 50"/>
<path class="lost-bridge" d="M122 70H146"/>
<g class="lost-badge"><circle cx="134" cy="70" r="10"/><path d="M130.5 66.5A3.5 3.5 0 1 1 135.5 69.7C134.3 70.3 134 71 134 72"/><path d="M134 75.5V75.6"/></g>
<g class="lost-staff"><circle cx="214" cy="26" r="7"/><path d="M214 33V84"/><path d="M206 43H222"/></g>
</svg>`;
}
