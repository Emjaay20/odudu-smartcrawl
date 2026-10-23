// The Markdown copy of an `.mdx` page. The llms plugin already turns tabs into
// bold labels and drops components; what it leaves is the page's import lines,
// which mean nothing to a reader of Markdown.
export function dropImports(text: string): string {
  let fenced = false;
  const kept: string[] = [];
  for (const line of text.split('\n')) {
    if (/^(`{3,}|~{3,})/u.test(line)) fenced = !fenced;
    if (!fenced && /^import .+ from '.+';?$/u.test(line)) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/gu, '\n\n');
}
