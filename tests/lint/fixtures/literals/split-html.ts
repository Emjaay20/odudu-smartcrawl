export function renderSplit(name: string): string {
  const joined = '<p>Plea' + 'se wait</p>';
  const spans = `<p>Pl${name}ea${name}se wait</p>`;
  return joined + spans;
}
