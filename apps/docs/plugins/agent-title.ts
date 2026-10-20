// A page whose heading is its title in code marks reads "# `GET /audit`" in the
// source; the copy opens with the title as plain text and the body's own
// heading repeats it. The repeat is dropped when it is what follows the
// description and says no more than the title does.
export function dropRepeatedTitle(text: string, title: string, level: number): string {
  const marks = '#'.repeat(level);
  const lines = text.split('\n');
  if (lines[0] !== `${marks} ${title}`) return text;
  let index = 1;
  while (index < lines.length && (lines[index] === '' || lines[index]?.startsWith('>') === true)) {
    index += 1;
  }
  const heading = lines[index] ?? '';
  if (!heading.startsWith(`${marks} `)) return text;
  if (heading.slice(marks.length + 1).replaceAll('`', '') !== title) return text;
  lines.splice(index, lines[index + 1] === '' ? 2 : 1);
  return lines.join('\n');
}
