import { readFileSync } from 'node:fs';
import path from 'node:path';

const CHANGELOG = path.join(import.meta.dirname, '../../../CHANGELOG.md');
const DATED = /^## \[(\d+\.\d+\.\d+(?:-rc\.\d+)?)\] - \d{4}-\d{2}-\d{2}/gmu;

const versions = [...readFileSync(CHANGELOG, 'utf8').matchAll(DATED)].map(
  (match) => match[1] ?? '',
);
const newest = versions[0] ?? '';

// `releases/latest/download` skips pre-releases, so until a stable version has
// a dated changelog section the download address names the newest candidate.
export const stable = versions.some((version) => !version.includes('-rc.'));
export const candidateTag = `v${newest}`;
export const RELEASE_ASSET = stable
  ? 'releases/latest/download/compose.yaml'
  : `releases/download/${candidateTag}/compose.yaml`;
