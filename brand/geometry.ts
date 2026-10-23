// Where the staff sits inside each app tile, in the tile's 32 grid: the
// browser-tab icon keeps the mark large because it is read at 16 px, the touch
// and install icons leave the room a platform's own mask asks for.
export const FAVICON_INSET = { offset: 2, scale: 0.875 } as const;
export const TOUCH_INSET = { offset: 4, scale: 0.75 } as const;

export function insetTransform(inset: { offset: number; scale: number }): string {
  return `translate(${String(inset.offset)} ${String(inset.offset)}) scale(${String(inset.scale)})`;
}
