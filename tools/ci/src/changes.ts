export interface Changes {
  // Anything outside prose and the docs app changed: the heavy jobs run.
  server: boolean;
  // A change every job reads: the lockfile, a workflow, a tool, a root config.
  global: boolean;
  // The container image is built from the docs app too, so a change there
  // rebuilds it even when nothing else does.
  buildImage: boolean;
  docsOnly: boolean;
}

const EVERYTHING: Changes = { server: true, global: true, buildImage: true, docsOnly: false };

const GLOBAL = [
  /^\.github\//u,
  /^tools\//u,
  /^tests\//u,
  /^pnpm-lock\.yaml$/u,
  /^pnpm-workspace\.yaml$/u,
  /^package\.json$/u,
  /^turbo\.json$/u,
  /^tsconfig[^/]*\.json$/u,
  /^vitest[^/]*\.[cm]?[jt]s$/u,
  /^eslint\.config\.[cm]?js$/u,
  /^\.dependency-cruiser\.cjs$/u,
  /^\.prettier/u,
  /^\.npmrc$/u,
];

// `docs/protocols` is read by the trace check against every package's test
// report, so a change there is checked like code.
const PROSE = [/^docs\/(?!protocols\/)/u, /^[\w.-]+\.md$/u];

function isProse(file: string): boolean {
  return PROSE.some((pattern) => pattern.test(file));
}

export function classifyChanges(files: readonly string[] | undefined): Changes {
  if (files === undefined || files.length === 0) return EVERYTHING;
  let docsApp = false;
  let server = false;
  let global = false;
  for (const file of files) {
    if (file.split('/').includes('..')) return EVERYTHING;
    if (file.startsWith('apps/docs/')) docsApp = true;
    else if (isProse(file)) continue;
    else server = true;
    if (GLOBAL.some((pattern) => pattern.test(file))) global = true;
  }
  return { server, global, buildImage: server || docsApp, docsOnly: !server };
}
