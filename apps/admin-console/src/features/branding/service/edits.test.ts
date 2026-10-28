import type { ThemeAsset } from '@odudu/contracts/admin';
import { describe, expect, it, vi } from 'vitest';
import {
  altChanged,
  changedColours,
  contrastReport,
  DEFAULT_PALETTES,
  IDLE_SLOTS,
  NO_OUTCOME,
  publishOutcomeOf,
  selectOffered,
  slotAfterUpload,
  slotNames,
  slotView,
  unsavedSections,
  uploadedImage,
  uploadStart,
  type ImageValues,
} from '#/features/branding/service';
import type { GatewayResult } from '#/shared/service/result';

const none: ImageValues = {
  'assets.logo': null,
  'assets.darkLogo': null,
  'assets.favicon': null,
  'assets.background': null,
};
const asset = { id: 'a1', kind: 'logo' } as ThemeAsset;
const uploaded: GatewayResult<ThemeAsset> = {
  ok: true,
  status: 201,
  data: asset,
  etag: null,
  next: null,
};
const refused: GatewayResult<ThemeAsset> = {
  ok: false,
  kind: 'problem',
  problem: { type: 'about:blank#asset-animated', title: 't', status: 422 },
};

describe('an upload', () => {
  it('starts busy when the file may be sent, and fails in place when it may not', () => {
    const ok = uploadStart(IDLE_SLOTS, 'logo', { type: 'image/png', size: 10 });
    expect(ok.send).toBe(true);
    expect(ok.slots.logo).toEqual({ busy: true, error: null });
    const big = uploadStart(IDLE_SLOTS, 'logo', { type: 'image/png', size: 10_000_000 });
    expect(big.send).toBe(false);
    expect(big.slots.logo.busy).toBe(false);
    expect(big.slots.logo.error).toMatch(/over 256 KiB/u);
  });

  it('leaves its slot quiet when it landed, and says why when it was refused', () => {
    expect(slotAfterUpload(IDLE_SLOTS, 'logo', uploaded).logo).toEqual({
      busy: false,
      error: null,
    });
    expect(slotAfterUpload(IDLE_SLOTS, 'logo', refused).logo.error).toBe(
      'An animated image is not accepted.',
    );
  });

  it('fills its slot only when it landed, keeping a logo’s alt text', () => {
    const had = { ...none, 'assets.logo': { assetId: 'old', alt: 'Acme' } };
    expect(uploadedImage('logo', uploaded, had)).toEqual({ assetId: 'a1', alt: 'Acme' });
    expect(uploadedImage('logo', refused, had)).toBeNull();
  });
});

describe('a deleted image', () => {
  it('empties the slot only if the slot holds that very image', () => {
    const had = { ...none, 'assets.favicon': { assetId: 'f1' } };
    expect(slotNames(had, 'favicon', 'f1')).toBe(true);
    expect(slotNames(had, 'favicon', 'other')).toBe(false);
    expect(slotNames(had, 'logo', 'f1')).toBe(false);
  });
});

describe('what is marked changed', () => {
  it('is each colour that differs from the saved palette, none for a scheme left alone', () => {
    const now = { ...DEFAULT_PALETTES.light, inkPrimary: '#000000' };
    expect(changedColours(DEFAULT_PALETTES.light, now)).toEqual(['inkPrimary']);
    expect(changedColours(null, null)).toEqual([]);
    expect(changedColours(null, now)).toHaveLength(11);
  });

  it('is a logo’s alt text that differs from the saved one', () => {
    const saved = { ...none, 'assets.logo': { assetId: 'a', alt: 'A' } };
    const edited = { ...none, 'assets.logo': { assetId: 'a', alt: 'B' } };
    expect(altChanged(saved, edited, 'logo')).toBe(true);
    expect(altChanged(saved, saved, 'logo')).toBe(false);
    expect(altChanged(saved, saved, 'favicon')).toBe(false);
  });

  it('names the sections with unsaved edits, in the order they sit', () => {
    expect(unsavedSections(new Set(['templates', 'colours']))).toEqual([
      'Colours and font',
      'Page templates',
    ]);
    expect(unsavedSections(new Set())).toEqual([]);
  });
});

describe('the upload button’s name', () => {
  it('says it is uploading while it is', () => {
    expect(slotView('logo', none, true).uploadName).toBe('Uploading logo');
    expect(slotView('logo', none).uploadName).toBe('Upload logo');
  });
});

describe('the tabs', () => {
  it('select a tab this area has, and nothing for another name', () => {
    const select = vi.fn<(tab: string) => void>();
    selectOffered('pages', select);
    selectOffered('mail', select);
    selectOffered('nope', select);
    expect(select.mock.calls).toEqual([['pages']]);
  });
});

describe('a publish', () => {
  it('toasts only when it went through', () => {
    const ok = publishOutcomeOf(
      {
        ok: true,
        status: 200,
        data: { ...({} as object), warnings: [] } as never,
        etag: null,
        next: null,
      },
      () => '',
    );
    expect(ok.toast).toBe('Theme published');
    expect(publishOutcomeOf({ ok: false, kind: 'network' }, () => 'lost').toast).toBeNull();
    expect(NO_OUTCOME.toast).toBeNull();
  });

  it('tells a screen reader only whether the contrast passes', () => {
    const values = {
      'tokens.light': DEFAULT_PALETTES.light,
      'tokens.dark': null,
      'tokens.font': null,
    };
    expect(contrastReport(values).verdict).toBe('Contrast passes.');
    const worse = {
      ...values,
      'tokens.light': { ...DEFAULT_PALETTES.light, inkPrimary: '#e8e8e8' },
    };
    expect(contrastReport(worse).verdict).toMatch(/^Contrast fails/u);
  });
});
