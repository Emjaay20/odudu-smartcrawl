import { describe, expect, it } from 'vitest';
import { releaseNotes } from '#/notes';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something not yet released.

## [0.2.0] - 2026-11-01

### Added

- Two.

### Security

- Three.

## [0.1.0-rc.1] - 2026-10-30

### Added

- One.

[Unreleased]: https://example.com/compare/v0.2.0...HEAD
[0.2.0]: https://example.com/compare/v0.1.0-rc.1...v0.2.0
[0.1.0-rc.1]: https://example.com/releases/tag/v0.1.0-rc.1
`;

describe('releaseNotes', () => {
  it('returns the body of the version, up to the next heading', () => {
    expect(releaseNotes(CHANGELOG, '0.2.0')).toBe(
      '### Added\n\n- Two.\n\n### Security\n\n- Three.',
    );
  });

  it('leaves the link definitions at the foot out of the last section', () => {
    expect(releaseNotes(CHANGELOG, '0.1.0-rc.1')).toBe('### Added\n\n- One.');
  });

  it('does not take 0.2.0 for a version that merely starts with it', () => {
    expect(() => releaseNotes(CHANGELOG, '0.2')).toThrow(/not a version/u);
    expect(() => releaseNotes(CHANGELOG, '0.2.0-rc.1')).toThrow(/no section/u);
    expect(() => releaseNotes(CHANGELOG, '0.2.1')).toThrow(/no section/u);
  });

  it('refuses a version with no section, and a section with nothing in it', () => {
    expect(() => releaseNotes(CHANGELOG, '9.9.9')).toThrow(/no section/u);
    expect(() =>
      releaseNotes('## [1.0.0] - 2026-01-01\n\n## [0.9.0] - 2025-01-01\n- x', '1.0.0'),
    ).toThrow(/empty/u);
  });

  it('refuses Unreleased as a release', () => {
    expect(() => releaseNotes(CHANGELOG, 'Unreleased')).toThrow(/not a version/u);
  });
});
