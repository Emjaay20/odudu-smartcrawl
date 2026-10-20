import type { Page } from '@playwright/test';

/** A control or heading the page must show before it is photographed. */
export type Expectation =
  | { readonly heading: string }
  | { readonly role: 'button' | 'link' | 'tab'; readonly name: string }
  | { readonly label: string };

export interface Context {
  readonly base: string;
  readonly tenant: string;
}

/**
 * One captured screen. `open` leaves the page showing what is to be
 * photographed; `expect` is checked afterwards, so a console that has lost a
 * heading or a control fails the capture instead of producing a picture of
 * something else. A later increment adds screens to the list and nothing else.
 */
export interface Screen {
  readonly name: string;
  readonly alt: string;
  readonly caption: string;
  readonly signedIn: boolean;
  readonly expect: readonly Expectation[];
  readonly open: (page: Page, context: Context) => Promise<void>;
  // Runs after the shot, for a screen that has to be left (a dialog closed, a form submitted).
  readonly leave?: (page: Page, context: Context) => Promise<void>;
}
