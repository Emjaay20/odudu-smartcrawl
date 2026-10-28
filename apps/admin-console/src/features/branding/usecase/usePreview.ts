import type { ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { previewSource } from '#/features/branding/repository/preview';
import {
  DEFAULT_PREVIEW,
  omissionNote,
  previewKey,
  previewWith,
  type PageKind,
  type PreviewChoice,
  type Scheme,
  type ThemeScope,
} from '#/features/branding/service';

export interface Preview {
  choice: PreviewChoice;
  // The frame's address, and the key that reloads it when what it shows changed.
  src: string;
  frameKey: string;
  note: string | null;
  // The frame has not finished loading what it was asked for.
  loading: boolean;
  onLoaded: () => void;
  setKind: (kind: PageKind) => void;
  setScheme: (scheme: Scheme) => void;
}

// What the preview frame shows: one page kind in one scheme, of the saved draft.
export function usePreview(
  tenant: string,
  scope: ThemeScope,
  view: ThemeView | undefined,
  tag: string | null,
): Preview {
  const [choice, setChoice] = useState(DEFAULT_PREVIEW);
  const [loaded, setLoaded] = useState('');
  const frameKey = previewKey(view, tag, choice);
  return {
    choice,
    src: previewSource(tenant, scope, choice),
    frameKey,
    note: omissionNote(choice.kind),
    loading: loaded !== frameKey,
    onLoaded: () => {
      setLoaded(frameKey);
    },
    setKind: (kind) => {
      setChoice((was) => previewWith(was, { kind }));
    },
    setScheme: (scheme) => {
      setChoice((was) => previewWith(was, { scheme }));
    },
  };
}
