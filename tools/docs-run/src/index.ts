import { runDirectories } from '#/main';

const roots = process.argv.slice(2);
if (roots.length === 0) {
  process.stderr.write('usage: odudu-docs-run <directory>...\n');
  process.exit(2);
}

process.exit(
  await runDirectories(roots, {
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  }),
);
