import type { MailBrandingView, ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { mailPreviewSource } from '#/features/branding/repository/mailPreview';
import { useMailBranding } from '#/features/branding/repository/useMailBranding';
import {
  DEFAULT_MAIL_CHOICE,
  mailChoiceWith,
  mailFrameKey,
  type MailChoice,
  type Scheme,
} from '#/features/branding/service';
import type { Read } from '#/shared/service/read';

export interface MailTab {
  choice: MailChoice;
  src: string;
  frameKey: string;
  loading: boolean;
  onLoaded: () => void;
  setScheme: (scheme: Scheme) => void;
  setLocale: (locale: string) => void;
  branding: Read<MailBrandingView>;
  // The address the console is served from.
  origin: string;
}

// The verification mail as the published theme dresses it, and what it inherits.
export function useMailTab(tenant: string, view: ThemeView | undefined, asked: boolean): MailTab {
  const [choice, setChoice] = useState(DEFAULT_MAIL_CHOICE);
  const [loaded, setLoaded] = useState('');
  const version = view?.published?.version;
  const frameKey = mailFrameKey(version, choice);
  return {
    choice,
    src: mailPreviewSource(tenant, choice),
    frameKey,
    loading: loaded !== frameKey,
    onLoaded: () => {
      setLoaded(frameKey);
    },
    setScheme: (scheme) => {
      setChoice((was) => mailChoiceWith(was, { scheme }));
    },
    setLocale: (locale) => {
      setChoice((was) => mailChoiceWith(was, { locale }));
    },
    origin: globalThis.location.origin,
    branding: useMailBranding(tenant, version, asked),
  };
}
