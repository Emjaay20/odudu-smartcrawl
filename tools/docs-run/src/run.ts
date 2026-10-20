import type { RunnableBlock } from '#/parse';

export interface Result {
  readonly file: string;
  readonly line: number;
  readonly ok: boolean;
  readonly output: string;
  readonly failure?: string;
}

type Exec = (
  command: string,
  env: Record<string, string>,
) => Promise<{ status: number; output: string }>;

/**
 * Runs each file's blocks in document order and stops that file at its first
 * failure; the other files still run. The runner receives `block.command`
 * untouched: the text that is run is the text that is published.
 */
export async function runBlocks(blocks: readonly RunnableBlock[], exec: Exec): Promise<Result[]> {
  const results: Result[] = [];
  const failed = new Set<string>();
  for (const block of blocks) {
    if (failed.has(block.file)) continue;
    const { status, output } = await exec(block.command, { ...block.env });
    const where = `${block.file}:${String(block.line)}`;
    const missing = block.expect.find((text) => !output.includes(text));
    const failure =
      status !== 0
        ? `${where}: exit ${String(status)}\n${output}`
        : missing !== undefined
          ? `${where}: output does not contain "${missing}"\n${output}`
          : undefined;
    if (failure === undefined) {
      results.push({ file: block.file, line: block.line, ok: true, output });
    } else {
      failed.add(block.file);
      results.push({ file: block.file, line: block.line, ok: false, output, failure });
    }
  }
  return results;
}
