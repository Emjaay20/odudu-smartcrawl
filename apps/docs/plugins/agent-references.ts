import type { MachineReadableReference } from '../nav';

export function appendReferences(
  llmsTxt: string,
  references: readonly MachineReadableReference[],
  urlPrefix: string,
): string {
  if (references.length === 0) return llmsTxt;
  const lines = references.map(
    (reference) =>
      `- [${reference.title}](${urlPrefix}${reference.file}): ${reference.description}`,
  );
  return `${llmsTxt.trimEnd()}\n\n## Machine-readable references\n\n${lines.join('\n')}\n`;
}
