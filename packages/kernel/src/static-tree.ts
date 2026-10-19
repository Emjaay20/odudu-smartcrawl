import { lstat, readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { OduduError } from '#/errors';

export interface StaticFile {
  readonly content: Buffer;
  readonly contentType: string;
}

export interface StaticTreeLimits {
  readonly maxFileBytes: number;
  readonly maxFiles: number;
  readonly maxTotalBytes: number;
}

// Reads a built directory once into memory, keyed by `/`-separated path, so a
// server holds the whole tree and touches no filesystem per request. The
// limits bound that memory: one oversized file is refused with a warning,
// while a tree past `maxFiles` or `maxTotalBytes` is not the tree that was
// meant to be served and throws.
export async function readStaticTree(
  dir: string,
  types: Readonly<Record<string, string>>,
  limits: StaticTreeLimits,
  warn: (message: string) => void,
): Promise<ReadonlyMap<string, StaticFile>> {
  const files = new Map<string, StaticFile>();
  let totalBytes = 0;

  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      // `readdir`'s dirents are lstat-based: a symlink is never `isFile()`,
      // whatever it points at, so the walk never follows one out of `dir`.
      if (!entry.isFile()) continue;
      const contentType = types[extname(entry.name)];
      if (contentType === undefined) continue;
      const { size } = await lstat(full);
      if (size > limits.maxFileBytes) {
        warn(`static file over ${String(limits.maxFileBytes)} bytes, refused: ${full}`);
        continue;
      }
      if (files.size + 1 > limits.maxFiles) {
        throw new OduduError(
          'static_tree_too_large',
          `${dir} holds more than ${String(limits.maxFiles)} files`,
        );
      }
      totalBytes += size;
      if (totalBytes > limits.maxTotalBytes) {
        throw new OduduError(
          'static_tree_too_large',
          `${dir} holds more than ${String(limits.maxTotalBytes)} bytes`,
        );
      }
      files.set(relative(dir, full).split(sep).join('/'), {
        content: await readFile(full),
        contentType,
      });
    }
  }

  await walk(dir);
  return files;
}
