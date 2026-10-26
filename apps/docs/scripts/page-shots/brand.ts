// Another brand's colours for a server page: only colour tokens are replaced,
// so the markup and the layout stay exactly the real page's.

export const BRAND_TOKENS: Record<string, string> = {
  '--surface-page': 'light-dark(#e9e8f6, #17162a)',
  '--surface-grid': 'light-dark(#dedcf1, #1e1c36)',
  '--surface-panel': 'light-dark(#ffffff, #1f1d38)',
  '--surface-sunken': 'light-dark(#f4f3fb, #151429)',
  '--border': 'light-dark(#d6d3ee, #302d52)',
  '--border-strong': 'light-dark(#b4b0dc, #46427a)',
  '--ink-primary': 'light-dark(#2a1f6b, #e6e3ff)',
  '--ink-muted': 'light-dark(#58528c, #a9a4d6)',
  '--signal-active-ink': 'light-dark(#4b35c9, #a99cff)',
  '--focus-ring': 'light-dark(#5b45e0, #9d8fff)',
};

export function brandStyle(): string {
  const declarations = Object.entries(BRAND_TOKENS)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  return `<style>:root { ${declarations} }</style>`;
}

// The tokens a brand replaces must be ones the stylesheet declares, or the
// swap would silently change nothing.
export function undeclared(tokensCss: string): string[] {
  return Object.keys(BRAND_TOKENS).filter((name) => !tokensCss.includes(`${name}:`));
}
