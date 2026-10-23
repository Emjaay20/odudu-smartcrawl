import type { RunnableBlock } from '#/parse';

export interface Result {
  readonly file: string;
  readonly line: number;
  readonly ok: boolean;
  readonly output: string;
  readonly failure?: string;
}

export interface ExecOptions {
  readonly timeoutSeconds?: number;
}

type Exec = (
  command: string,
  env: Record<string, string>,
  options: ExecOptions,
) => Promise<{ status: number; output: string }>;

function failureOf(block: RunnableBlock, status: number, output: string): string | undefined {
  const where = `${block.file}:${String(block.line)}`;
  if (status !== 0) return `${where}: exit ${String(status)}\n${output}`;
  const missing = block.expect.find((text) => !output.includes(text));
  if (missing !== undefined) return `${where}: output does not contain "${missing}"\n${output}`;
  return undefined;
}

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
    const options: ExecOptions =
      block.timeoutSeconds === undefined ? {} : { timeoutSeconds: block.timeoutSeconds };
    const { status, output } = await exec(block.command, { ...block.env }, options);
    const failure = failureOf(block, status, output);
    if (failure === undefined) {
      results.push({ file: block.file, line: block.line, ok: true, output });
    } else {
      failed.add(block.file);
      results.push({ file: block.file, line: block.line, ok: false, output, failure });
    }
  }
  return results;
}
