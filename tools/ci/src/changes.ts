export interface Changes {
  // Anything outside prose and the docs app changed: the heavy jobs run.
  server: boolean;
  // The container image is built from the docs app too, so a change there
  // rebuilds it even when nothing else does.
  buildImage: boolean;
  docsOnly: boolean;
}

const EVERYTHING: Changes = { server: true, buildImage: true, docsOnly: false };

// `docs/protocols` is read by the trace check against every package's test
// report, so a change there is checked like code. Only Markdown is prose: a
// data file or an image under docs/ may be read by a test.
const PROSE = [/^docs\/(?!protocols\/).*\.md$/u, /^[\w.-]+\.md$/u];

function isProse(file: string): boolean {
  return PROSE.some((pattern) => pattern.test(file));
}

// `files` must list both sides of a rename; the CLI diffs with --no-renames.
export function classifyChanges(files: readonly string[] | undefined): Changes {
  if (files === undefined || files.length === 0) return EVERYTHING;
  let docsApp = false;
  let server = false;
  for (const file of files) {
    if (file.split('/').includes('..')) return EVERYTHING;
    if (file.startsWith('apps/docs/')) docsApp = true;
    else if (!isProse(file)) server = true;
  }
  return { server, buildImage: server || docsApp, docsOnly: !server };
}
