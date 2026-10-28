import { describe, expect, it } from 'vitest';
import {
  altEdited,
  altProblem,
  bytesText,
  imageAfterUpload,
  imagesHold,
  inUse,
  inUseTitle,
  limitText,
  slotView,
  uploadFailureOf,
  uploadFailureText,
  uploadRefusal,
  type ImageValues,
} from '#/features/branding/service';

const none: ImageValues = {
  'assets.logo': null,
  'assets.darkLogo': null,
  'assets.favicon': null,
  'assets.background': null,
};

const problemOf = (type: string, status = 422, extra = {}) => ({
  type: `about:blank#${type}`,
  title: 'Refused',
  status,
  ...extra,
});

describe('limits', () => {
  it('state the size and side of each kind', () => {
    expect(limitText('logo')).toContain('up to 256 KiB and 1024 pixels');
    expect(limitText('background')).toContain('up to 1 MiB and 2560 pixels');
    expect(bytesText(256 * 1024)).toBe('256 KiB');
  });

  it('refuse a file over its size or of another type before it is sent', () => {
    expect(uploadRefusal('logo', { type: 'image/gif', size: 1 })).toBe(
      'That is not a PNG, a JPEG or a WebP.',
    );
    expect(uploadRefusal('favicon', { type: 'image/png', size: 300 * 1024 })).toMatch(
      /over 256 KiB/u,
    );
    expect(uploadRefusal('background', { type: 'image/webp', size: 300 * 1024 })).toBeNull();
    expect(uploadRefusal('logo', { type: '', size: 10 })).toBeNull();
  });
});

describe('a refused upload', () => {
  it('says 413 as too large even with no problem type', () => {
    expect(uploadFailureText('background', problemOf('', 413))).toMatch(/over 1 MiB/u);
  });

  it('says anything unknown in general terms, never the server’s detail', () => {
    expect(uploadFailureText('logo', problemOf('mystery', 500, { detail: 'decoder: x' }))).toBe(
      'The image was not uploaded.',
    );
  });

  it('distinguishes a lost answer from the console’s own fault', () => {
    expect(uploadFailureOf('logo', { ok: false, kind: 'network' })).toMatch(/Could not confirm/u);
    expect(uploadFailureOf('logo', { ok: false, kind: 'defect' })).toMatch(/fault in the console/u);
  });
});

describe('an image still in use', () => {
  const found = inUse(
    problemOf('asset-in-use', 409, {
      detail: 'a theme still names the image, more than errors lists',
      errors: [{ path: 'theme', message: 'named by the draft d' }],
    }),
  );

  it('lists the themes by path, and says when there are more', () => {
    expect(found?.lines).toEqual(['This tenant’s theme: named by the draft d.']);
    expect(found?.more).toBe(true);
    expect(found === null ? '' : inUseTitle(found)).toMatch(/still used by 1 theme or more/u);
  });

  it('is nothing for another problem', () => {
    expect(inUse(problemOf('asset-cap', 409))).toBeNull();
  });
});

describe('logos', () => {
  it('require alt text of at most 200 characters', () => {
    expect(altProblem('')).toBe('Describe the logo; it is required.');
    expect(altProblem('x'.repeat(201))).toMatch(/200 characters/u);
    expect(altProblem('Acme')).toBeUndefined();
  });

  it('start without alt text on first upload and keep it on replacement', () => {
    expect(imageAfterUpload('logo', 'a', none)).toEqual({ assetId: 'a', alt: '' });
    const had = { ...none, 'assets.logo': { assetId: 'old', alt: 'Acme' } };
    expect(imageAfterUpload('logo', 'new', had)).toEqual({ assetId: 'new', alt: 'Acme' });
    expect(imageAfterUpload('favicon', 'f', had)).toEqual({ assetId: 'f' });
  });

  it('hold Save until each logo has alt text', () => {
    expect(imagesHold(none)).toBeUndefined();
    expect(imagesHold({ ...none, 'assets.darkLogo': { assetId: 'a', alt: '' } })).toMatch(
      /alt text is required/u,
    );
    expect(altEdited(none, 'logo', 'x')).toBeNull();
  });

  it('name each slot’s actions for the screen reader', () => {
    const view = slotView('logo', {
      ...none,
      'assets.logo': { assetId: 'abcdef012345', alt: 'A' },
    });
    expect(view).toMatchObject({
      uploadName: 'Replace logo',
      deleteName: 'Delete image: logo',
      note: 'An image is set (abcdef01).',
      alt: 'A',
    });
    expect(slotView('favicon', none)).toMatchObject({ uploadName: 'Upload favicon', alt: null });
  });
});
